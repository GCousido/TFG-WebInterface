import uuid
import shutil
import os
import uvicorn
import re
import importlib
import logging

from zipfile import ZipFile, ZIP_DEFLATED
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from datasetconverter.cli import get_dataset_names


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("DatasetConverter-API")

# Create FastAPI
app = FastAPI()

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/convert")
async def convert_dataset(
    request: Request,
    input_format: str = Form(...),
    output_format: str = Form(...),
    zip_file: UploadFile = File(...)
) -> dict[str, str]:
    """
    Convert input dataset and return the download link to the converted dataset.

    Args:
        request (Request): The FastAPI request object.
        input_format (str): The input dataset format.
        output_format (str): The target dataset format.
        zip_file (UploadFile): The uploaded ZIP file containing the dataset.

    Returns:
        dict[str, str]: A dictionary with a download link or an error message.
    """
    logger.info("Request for dataset conversion received")
    job_id = str(uuid.uuid4())
    input_path = f"./temp_uploads/{job_id}/"
    output_path = f"./conversion_results/{output_format}/{job_id}"
    zip_path = f"{input_path}uploaded.zip"

    os.makedirs(input_path, exist_ok=True, mode=0o777)
    os.makedirs(output_path, exist_ok=True, mode=0o777)
    os.chmod(input_path, 0o777)
    os.chmod(output_path, 0o777)

    try:
        # Save and extract the uploaded ZIP file
        with open(zip_path, "wb") as buffer:
            shutil.copyfileobj(zip_file.file, buffer)
        shutil.unpack_archive(zip_path, input_path, 'zip')
        logger.info(f"ZIP extracted to: {input_path}")
        os.remove(zip_path)

        # Find the root folder
        root_folder = next((f for f in os.listdir(input_path) if f != "uploaded.zip"), None)
        actual_input_path = os.path.join(input_path, root_folder) if root_folder else input_path
        logger.info(f"Root folder: {os.listdir(input_path)[0]}")

        # Convert dataset
        result: dict[str, str] = convert(job_id, input_format, actual_input_path, output_format, output_path)

        # Return error happened during conversion
        if "error" in result:
            logger.error(f"Error during conversion: {result['error']}")
            return {"error": result["error"]}

        # Verify there is generated content, if there isn't return error
        if not os.path.exists(output_path) or not os.listdir(output_path):
            logger.error("There was no content generated during conversion")
            return {"error": "There was no content generated during conversion"}

        # Compress in a ZIP the output dataset
        zip_path = f"{output_path}.zip"
        create_zip_multithreaded(output_path, zip_path, min(32, (os.cpu_count() or 1) + 4))
        logger.info(f"ZIP created: {zip_path}")

        # Return link to download the output dataset
        return {
            "download_link": f"{request.base_url}download/{output_format}/{job_id}".replace("//download", "/download")
        }
    except Exception as e:
        logger.error(f"Error processing ZIP file: {str(e)}")
        return {"error": f"Error processing ZIP file: {str(e)}"}
    finally:
        # Clean up temporary files and directories
        logger.info("Cleaning up temporary files and directories")
        shutil.rmtree(input_path, ignore_errors=True)
        shutil.rmtree(output_path, ignore_errors=True)



@app.get("/download/{output_format}/{job_id}")
def download(output_format: str, job_id: str):
    """
    Returns the converted dataset ZIP file for download.

    Args:
        output_format (str): The target format.
        job_id (str): The job UUID.

    Returns:
        FileResponse | dict[str, str]: The ZIP file or an error message.
    """
    zip_path = f"./conversion_results/{output_format}/{job_id}.zip"
    if os.path.exists(zip_path):
        logger.info(f"Download requested for: {zip_path}")
        return FileResponse(zip_path, filename=f"converted_{output_format}_dataset_{job_id}.zip")

    logger.error("Download file not found")
    return {"error": "Download file not found"}


# Mount static files
app.mount("/", StaticFiles(directory=os.path.abspath(os.path.join(os.path.dirname(__file__), "../static")), html=True), name="static")


def clean_error_message(error_message: str, base_temp_path: str) -> str:
    """
    Cleans redundant or sensitive information from CLI error messages.

    Args:
        error_message (str): The error message to clean.
        base_temp_path (str): The base temporary path to remove.

    Returns:
        str: The cleaned error message.
    """
    cleaned = re.sub(r'Error while converting: ', '', error_message)
    cleaned = cleaned.replace('\\', '/')

    if base_temp_path in cleaned:
        cleaned = cleaned.replace(base_temp_path, '')
    return cleaned


def add_file_to_zip(lock, zip_handle, file_path, root_dir):
    """
    Adds a file to a ZIP archive in a thread-safe manner.

    Args:
        lock (Lock): Threading lock for ZIP writing.
        zip_handle (ZipFile): The ZIP file handle.
        file_path (str): Path to the file to add.
        root_dir (str): Root directory for relative paths.
    """
    with open(file_path, "rb") as f:
        data = f.read()

    arcname = os.path.relpath(file_path, root_dir)

    with lock:
        zip_handle.writestr(arcname, data)


def create_zip_multithreaded(source_dir, output_zip, workers=4):
    """
    Creates a ZIP archive from a directory using multiple threads.

    Args:
        source_dir (str): Directory to archive.
        output_zip (str): Output ZIP file path.
        workers (int): Number of worker threads. Default 4.
    """
    with ThreadPoolExecutor(max_workers=workers) as executor, ZipFile(output_zip, "w", ZIP_DEFLATED) as zipf:

        lock = Lock()
        futures = []

        for root, _, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                futures.append(
                    executor.submit(
                        add_file_to_zip,
                        lock,
                        zipf,
                        file_path,
                        source_dir
                    )
                )

        for future in futures:
            future.result()


def convert(job_id: str, input_format: str, input_path: str, output_format: str, output_path: str) -> dict[str, str]:
    """
    Converts a dataset from the input format to the output format.

    Args:
        input_format (str): Input dataset format.
        input_path (str): Path to the input dataset.
        output_format (str): Output dataset format.
        output_path (str): Path to save the converted dataset.

    Returns:
        dict[str, str]: Success or error message.
    """
    try:
        logger.info("Starting dataset conversion")
        if not os.access(os.path.dirname(output_path), os.W_OK):
            logger.error("Output path is not writable")
            return {"error": "Output path is not writable"}

        # Dynamic import of format classes
        input_format_module = importlib.import_module(f'datasetconverter.formats.{input_format}')
        input_format_class_name = f"{get_dataset_names(input_format)}Format"
        input_format_class = getattr(input_format_module, input_format_class_name)

        output_format_module = importlib.import_module(f'datasetconverter.formats.{output_format}')
        output_format_class_name = f"{get_dataset_names(output_format)}Format"
        output_format_class = getattr(output_format_module, output_format_class_name)

        # Dynamic import of converters
        input_converter_module = importlib.import_module(f'datasetconverter.converters.{input_format}_converter')
        input_converter_class_name = f"{get_dataset_names(input_format)}Converter"
        input_converter_class = getattr(input_converter_module, input_converter_class_name)

        output_converter_module = importlib.import_module(f'datasetconverter.converters.{output_format}_converter')
        output_converter_class_name = f"{get_dataset_names(output_format)}Converter"
        output_converter_class = getattr(output_converter_module, output_converter_class_name)

        # Load input dataset
        input_dataset = input_format_class.read_from_folder(input_path)

        # Convert to NeutralFormat
        neutral_format = input_converter_class.toNeutral(input_dataset)

        # Convert to output format
        output_dataset = output_converter_class.fromNeutral(neutral_format)

        # Save output dataset 
        output_dataset.save(output_path)

        logger.info("Dataset conversion successful")
        return {"success": "True"}
    except ImportError as e:
        logger.error(f"Could not import necessary modules: {e}")
        return {"error": f"Could not import necessary modules: {e}"}
    except AttributeError as e:
        logger.error(f"Lacking class or required method: {e}")
        return {"error": f"Lacking class or required method: {e}"}
    except Exception as e:
        logger.error(f"Error while converting: {e}")
        return {"error": f"{clean_error_message(str(e),f"./temp_uploads/{job_id}")}"}


if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        port=8080
    )
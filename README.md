# Web Interface for DatasetConverter

This project is a web interface for the library [**TFG-DatasetConverter**](https://github.com/GCousido/TFG-DatasetConverter).

## Overview

The web interface provides an easy-to-use platform for converting and processing datasets using the [**TFG-DatasetConverter**](https://github.com/GCousido/TFG-DatasetConverter) Python library. It is designed to simplify data handling tasks, especially for users working with various dataset formats in machine learning and computer vision projects.

## Features

- User-friendly web interface for uploading and converting datasets.
- Built with FastAPI, ensuring fast and reliable backend performance for file processing and conversion tasks.
- Supports multiple data formats: YOLO, COCO, Pascal VOC, LabelMe JSON, TensorFlow CSV, VGG Image Annotator JSON and CreateML.
- Example datasets for each format.

## Getting Started

### 1. Clone the repository

```bash
    git clone https://github.com/GCousido/TFG-WebInterface.git
    cd TFG-WebInterface
```

### 2. Install dependencies

```bash
    pip install -r requirements.txt
```

### 3. Run the application

```bash
    cd API
    python api.py
```

The web interface will be available at `http://localhost:8080`.

## Usage

- Upload your dataset files directly through the web interface.
- Select the desired input and output formats.
- Start the conversion process and download the converted files once completed.

## Requirements

- Python 3.12+
- The TFG-[TFG-DatasetConverter](https://github.com/GCousido/TFG-DatasetConverter) library (installed automatically via requirements)

## License

This project is licensed under the MIT License.

---

For more details on the underlying conversion capabilities, refer to the [TFG-DatasetConverter](https://github.com/GCousido/TFG-DatasetConverter) library documentation.

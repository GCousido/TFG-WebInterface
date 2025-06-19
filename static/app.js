// Element Selectors 
const inputFormat = document.getElementById('input-format');
const outputFormat = document.getElementById('output-format');

const exampleSection = document.getElementById("example-section");
const exampleInput = document.getElementById("input-example-link");
const exampleOutput = document.getElementById("output-example-link");

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dropText = document.getElementById('drop-text');
const browseFiles = document.getElementById('browseFiles');
const form = document.getElementById('convertForm');

const fileList = document.getElementById('file-list');
const filesContainer = document.getElementById('files-container');

const convertBtn = document.getElementById('convert-btn');

const resultsSection = document.getElementById('results-section');
const resultDiv = document.getElementById("result-div");
const resultIcon = document.getElementById("result-icon");
const resultTitle = document.getElementById("result-title");
const resultMessage = document.getElementById("result-message");
const resultButtons = document.getElementById("result-buttons");

const resultLink = document.getElementById('resultLink');
const newConversionBtn = document.getElementById('new-conversion-btn');
const downloadLocationBtn = document.getElementById('download-location');

// Constants and Variables
let filesToUpload = [];
const formatPerAnnotationType = {
                                "json": ["coco","createml","labelme","vgg"],
                                "xml": ["pascal_voc"],
                                "csv": ["tensorflow_csv"],
                                "txt": ["yolo"]
                            };
const formatsThatSendImages = ["yolo","createml","vgg"];
const formatsShowRepresentation = {
    "yolo": "YOLO",
    "pascal_voc": "Pascal VOC",
    "coco": "COCO",
    "createml": "CreateML",
    "tensorflow_csv": "Tensorflow CSV",
    "labelme": "LabelMe JSON",
    "vgg": "VGG JSON"
};

// Event Listeners

// Reloads the page for a new conversion
newConversionBtn.addEventListener('click', () => document.location.reload());

// Handles the download and extraction of the converted dataset to a user-selected directory
downloadLocationBtn.addEventListener('click', async (e) => {
    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker();
    } catch (err) {
        alert("Couldn't select the directory: " + err);
        return;
    }

    const url = resultLink.href;
    let response;
    try {
        response = await fetch(url, {
            method: 'GET'
        });
        if (!response.ok) throw new Error("Couldn't download ZIP");
    } catch (err) {
        alert('Error: ' + err);
        return;
    }
    const zipBlob = await response.blob();


    const zip = await JSZip.loadAsync(zipBlob);

    const uuid = crypto.randomUUID();
    const mainFolderName = "ConvertedDataset_" + uuid;
    let mainDirHandle = await dirHandle.getDirectoryHandle(mainFolderName, { create: true });

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir) {
            const fileData = await zipEntry.async('uint8array');

            const pathParts = relativePath.split('/');
            let currentDir = mainDirHandle;
            for (let i = 0; i < pathParts.length - 1; i++) {
                currentDir = await currentDir.getDirectoryHandle(pathParts[i], { create: true });
            }

            const fileHandle = await currentDir.getFileHandle(pathParts[pathParts.length - 1], { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(fileData);
            await writable.close();
        }
    }

    alert('Dataset downloaded and extracted.');
});

// Handles drag and drop area click to trigger file input
dropZone.addEventListener('click', () => fileInput.click());

// Adds visual feedback when dragging files over the drop zone
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

// Removes visual feedback when dragging leaves the drop zone
dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
    }
});

// Updates file list and validation when input or output format changes
inputFormat.addEventListener('change', (e) => {
    displayFiles();
    changeExampleSection();
    validateConversion();
});
outputFormat.addEventListener('change', (e) => {
    changeExampleSection();
    validateConversion();
});

// Handles files dropped into the drop zone
dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    filesToUpload = [];
    const items = e.dataTransfer.items;
    
    for (const item of items) {
        if (item.kind === 'file') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
                await processEntry(entry);
            }
        }
    }
    
    dropText.textContent = `${filesToUpload.length} selected file${filesToUpload.length === 1 ? '' : 's'}`;
    browseFiles.textContent = "Click here to change selection"
    displayFiles();
    validateConversion();
});

// Handles file selection via the file input
fileInput.addEventListener('change', (e) => {
    filesToUpload = Array.from(e.target.files);
    dropText.textContent = `${filesToUpload.length} selected file${filesToUpload.length === 1 ? '' : 's'}`;
    browseFiles.textContent = "Click here to change selection"
    displayFiles();
    validateConversion();
});

// Handles form submission: zips files and sends them to the backend for conversion
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearResultSection();

    if (!filesToUpload.length) {
        setErrorMessage('Please, select one dataset.');
        return;
    }

    const annotationType = getAnnotationTypeForFormat(inputFormat.value);
    const includeImages = formatsThatSendImages.includes(inputFormat.value.toLowerCase());

    const images = filesToUpload.filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'bmp'].includes(ext);
    });

    const annotations = filesToUpload.filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return ext === annotationType;
    });

    let errorMessages = [];
    if (includeImages && images.length === 0) {
        errorMessages.push("No image files found for the selected format.");
    }
    if (annotations.length === 0) {
        errorMessages.push("No annotation files found for the selected format.");
    }

    if (errorMessages.length > 0) {
        setErrorMessage(errorMessages.join(' '));
        return;
    }

    const filesToSend = includeImages ? images.concat(annotations) : annotations;

    // Create ZIP in Client Side
    const zip = new JSZip();
    for (const file of filesToSend) {
        const relativePath = file._webkitRelativePath || file.webkitRelativePath || file.name;
        const fileData = await file.arrayBuffer();
        zip.file(relativePath, fileData);
    }
    const zipBlob = await zip.generateAsync({ type: "blob" }); // Generate ZIP as BLOB

    const formData = new FormData();
    formData.append('input_format', inputFormat.value);
    formData.append('output_format', outputFormat.value);
    formData.append('zip_file', zipBlob, 'dataset.zip'); // Send ZIP to backend

    // Send POST request to the backend with data to convert and update result section
    try {
        const response = await fetch('http://localhost:8080/convert', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (response.ok && result.download_link) {
            setSuccessMessage(result);
        } else {
            throw new Error(result.error || 'Error during conversion');
        }
    } catch (err) {
        setErrorMessage(err);
    }
});

// Prevents navigation when example links are disabled (no format selected)
exampleInput.addEventListener('click', function(e) {
    if(exampleInput.classList.contains('disabled-link')){
        e.preventDefault();
    }
});
exampleOutput.addEventListener('click', function(e) {
    if(exampleOutput.classList.contains('disabled-link')){
        e.preventDefault();
    }
});

// Utility and Core Functions

/**
 * Clears the result section UI and hides messages.
 */
function clearResultSection() {
    resultDiv.classList.remove("error-message");
    resultDiv.classList.remove("success-message");

    resultIcon.textContent = "";
    resultTitle.textContent = "";
    resultMessage.textContent = "";

    resultButtons.classList.add('hidden');
    resultsSection.classList.add('hidden');
}

/**
 * Displays a success message and download link after conversion.
 * @param {Object} result - Backend response object containing download_link.
 */
function setSuccessMessage(result) {
    resultDiv.classList.add("success-message");

    resultIcon.textContent = "✅";
    resultTitle.textContent = "Conversion Successfully Completed";
    resultMessage.textContent = "Your dataset has been converted and is ready to download.";
    resultLink.href = result.download_link;

    resultButtons.classList.remove('hidden');
    resultsSection.classList.remove('hidden');
}

/**
 * Displays an error message in the result section.
 * @param {string} errorMessage - The error message to display.
 */
function setErrorMessage(errorMessage) {
    resultDiv.classList.add("error-message");

    resultIcon.textContent = "❌";
    resultTitle.textContent = "Error during conversion";
    resultMessage.textContent = errorMessage;

    resultsSection.classList.remove('hidden');
}

/**
 * Recursively processes files and directories dropped into the drop zone.
 * @param {FileSystemEntry} entry - The file or directory entry.
 * @param {string} path - The current path for relative file placement.
 */
async function processEntry(entry, path = '') {
    return new Promise(async (resolve) => {
        if (entry.isFile) {
            const file = await new Promise(res => entry.file(res));
            file._webkitRelativePath = path + entry.name;
            filesToUpload.push(file);
            resolve();
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const entries = await new Promise(res => dirReader.readEntries(res));
            for (const childEntry of entries) {
                await processEntry(childEntry, path + entry.name + "/");
            }
            resolve();
        }
    });
}

/**
 * Enables or disables the convert button based on format selection and file presence.
 */
function validateConversion() {
    const inputVal = inputFormat.value;
    const outputVal = outputFormat.value;
    const filesOk = filesToUpload.length > 0;

    if (
        inputVal &&
        outputVal &&
        filesOk
    ) {
        convertBtn.disabled = false;
    } else {
        convertBtn.disabled = true;
    }
}

/**
 * Displays the selected files, grouped by type, in the UI.
 */
function displayFiles() {
    if (filesToUpload.length === 0) {
        fileList.classList.add('hidden');
        return;
    }

    fileList.classList.remove('hidden');
    filesContainer.innerHTML = '';

    const annotationType = getAnnotationTypeForFormat(inputFormat.value);
    
    // TODO: change to add other files
    const validFiles = filesToUpload.filter(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        return (['jpg', 'jpeg', 'png', 'bmp'].includes(ext)) || 
                (annotationType && ext === annotationType);
    });

    // Group files by type for better display
    const fileTypes = { images: [], annotations: [], other: [] };
    
    filesToUpload.forEach(file => {
        const ext = file.name.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'bmp'].includes(ext)) {
            fileTypes.images.push(file);
        } else if (annotationType && ext === annotationType) {
            fileTypes.annotations.push(file);
        } else {
            fileTypes.other.push(file);
        }
    });

    // Display files grouped by type
    Object.entries(fileTypes).forEach(([type, files]) => {
        if (files.length > 0) {
            const typeHeader = document.createElement('div');
            typeHeader.className = 'file-type-header';
            typeHeader.classList.add('type-header')
            typeHeader.textContent = `${type} (${files.length})`;
            filesContainer.appendChild(typeHeader);
            files.slice(0, 5).forEach(file => {
                createFileItem(file);
            });
            if (files.length > 5) {
                const moreItem = document.createElement('div');
                moreItem.className = 'file-item';
                moreItem.innerHTML = `
                    <span class="file-name">... and ${files.length - 5} more files</span>
                    <span class="file-size"></span>
                `;
                filesContainer.appendChild(moreItem);
            }
        }
    });

    // Add total summary TODO: add all files size
    const summary = document.createElement('div');
    summary.classList.add('summary')
    summary.textContent = `Total: ${filesToUpload.length} selected file${filesToUpload.length === 1 ? '' : 's'}`;
    filesContainer.appendChild(summary);
}

/**
 * Creates and appends a file item to the files container.
 * @param {File} file - The file object to display.
 */
function createFileItem(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    
    const fileName = document.createElement('span');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    
    const fileSize = document.createElement('span');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(file.size);
    
    fileItem.appendChild(fileName);
    fileItem.appendChild(fileSize);
    filesContainer.appendChild(fileItem);
}

/**
 * Formats a file size in bytes into a human-readable string.
 * @param {number} bytes - The file size in bytes.
 * @returns {string} - The formatted file size.
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Returns the annotation file extension for a given format.
 * @param {string} format - The annotation format.
 * @returns {string|null} - The file extension or null if not found.
 */
function getAnnotationTypeForFormat(format) {
    const lowerFormat = format.toLowerCase();
    for (const [type, formats] of Object.entries(formatPerAnnotationType)) {
        if (formats.includes(lowerFormat)) {
            return type;
        }
    }
    return null;
}

/**
 * Updates the example download links based on the selected formats.
 */
function changeExampleSection(){
    if(inputFormat.value != ""){
        exampleInput.href = "./format_examples/" + inputFormat.value + "-example.zip";
        exampleInput.textContent = "📥 Download " + formatsShowRepresentation[inputFormat.value] + " Dataset Example";
        exampleInput.classList.remove('disabled-link');
    }else{
        exampleInput.href = "#";
        exampleInput.textContent = "First select input format to show example";
        exampleInput.classList.add('disabled-link');
    }

    if(outputFormat.value != ""){
        exampleOutput.href = "./format_examples/" + outputFormat.value + "-example.zip";
        exampleOutput.textContent = "📥 Download " + formatsShowRepresentation[outputFormat.value] + " Dataset Example";
        exampleOutput.classList.remove('disabled-link');
    }else{
        exampleOutput.href = "#";
        exampleOutput.textContent = "First select output format to show example";
        exampleOutput.classList.add('disabled-link');
    }

    if(inputFormat.value === "" && outputFormat.value === ""){
        exampleInput.classList.add('hidden');
        exampleOutput.classList.add('hidden');
    }else {
        exampleInput.classList.remove('hidden');
        exampleOutput.classList.remove('hidden');
    }
}
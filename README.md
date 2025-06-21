# Web Interface for DatasetConverter

This project is a web interface for the library [**TFG-DatasetConverter**](https://github.com/GCousido/TFG-DatasetConverter).

## Overview

This web interface provides an easy-to-use platform for converting and processing datasets using the [**TFG-DatasetConverter**](https://github.com/GCousido/TFG-DatasetConverter) Python library. It is designed to simplify data handling tasks for users working with various dataset formats in computer vision projects.

## Features

- User-friendly web interface for uploading and converting datasets.
- Built with FastAPI, ensuring fast and reliable backend performance for file processing and conversion tasks.
- Supports multiple data formats: YOLO, COCO, Pascal VOC, LabelMe JSON, TensorFlow CSV, VGG Image Annotator JSON and CreateML.
- Example datasets for each format.

## Installation

### Requirements

- Python 3.12+
- The [TFG-DatasetConverter](https://github.com/GCousido/TFG-DatasetConverter) library (installed automatically via requirements)

### 1. Clone the repository

```bash
    git clone https://github.com/GCousido/TFG-WebInterface.git
    cd TFG-WebInterface
```

### 2. Install dependencies

```bash
    pip install -r requirements.txt
```

## How to Use

### Start the API

```bash
    cd API
    python api.py
```

The web interface will be available at `http://localhost:8080`.

### Interface Usage

1. **Upload** your dataset files directly through the web interface.
2. **Select** the desired input and output formats.
3. **Start** the conversion process.
4. **Download** the converted files once completed.

## License

This project is licensed under the MIT License.

---

For more details on the underlying conversion capabilities, refer to the [TFG-DatasetConverter](https://github.com/GCousido/TFG-DatasetConverter) library documentation.

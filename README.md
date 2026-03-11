# Underwater Image Enhancement - PUGAN-Inspired System

🌊 **Physics-Guided Deep Learning for Underwater Image Restoration**

This software-only system uses a PUGAN-inspired physical model-guided pipeline to enhance underwater images by correcting color distortion, reducing haze, and improving contrast while preserving natural appearance.

## 🚀 Features

- **Web-based Interface**: Easy-to-use drag-and-drop web application
- **Physical Model-Guided Enhancement**: Based on underwater light propagation physics
- **Real-time Metrics**: Automatic computation of image quality metrics
- **Noise Reduction**: Built-in denoising to reduce artifacts
- **Cross-platform**: Works on any device with a web browser

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Technical Details](#technical-details)
- [Mathematical Formulas](#mathematical-formulas)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- PyTorch 2.0+
- Modern web browser

### Running Locally

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd pugan
   pip install -r requirements.txt
   ```

2. **Start the backend:**
   ```bash
   cd web_backend
   pip install -r requirements.txt
   python app.py
   ```

3. **Open the frontend:**
   - Open `web_frontend/index.html` in your web browser
   - Or serve it with a local server: `python -m http.server 8000`

4. **Upload an underwater image** and see the enhancement results!

## 📦 Installation

### Backend Dependencies

```bash
pip install torch torchvision pillow numpy flask flask-cors opencv-python-headless gunicorn
```

### Frontend Dependencies

No installation required - pure HTML/CSS/JavaScript application.

## 🎯 Usage

1. **Upload Image**: Drag and drop or click to select an underwater image (JPG/PNG, max 10MB)
2. **Processing**: The system automatically processes the image using the trained model
3. **View Results**: Compare original vs enhanced images with detailed metrics
4. **Download**: Save the enhanced image for your use

### Metrics Explained

The system provides comprehensive quality metrics:

- **MSE/PSNR**: Measures pixel-level differences and signal quality
- **MAE**: Average absolute difference between images
- **Brightness/Contrast Changes**: How much the image's overall brightness and contrast are modified
- **Noise Levels**: Standard deviation of pixel intensities (lower is better)

## 🔬 Technical Details

### Architecture Overview

The system implements a lightweight PUGAN-inspired pipeline:

1. **Depth Estimation**: Analyzes image to estimate scene depth
2. **Transmission Map Computation**: Models wavelength-dependent light absorption/scattering
3. **Physical Model Inversion**: Corrects color distortion using physics-based principles
4. **Degradation-Aware Refinement**: Focuses enhancement on degraded regions
5. **Noise Reduction**: Optional denoising to reduce artifacts

### Model Components

- **DepthEstimationModule**: CNN-based depth estimation from RGB images
- **TransmissionMapModule**: Computes RGB transmission maps
- **PhysicalModelInversion**: Implements the underwater image formation model
- **DegradationAwareRefinement**: Final enhancement refinement

## 📐 Mathematical Formulas

### Image Quality Metrics

#### Mean Squared Error (MSE)
```
MSE = (1/N) * Σ(I_enhanced[i] - I_original[i])²
```
Where N is the total number of pixels, I_enhanced and I_original are pixel intensities.

#### Peak Signal-to-Noise Ratio (PSNR)
```
PSNR = 10 * log₁₀(MAX² / MSE) = 10 * log₁₀(1 / MSE)
```
Since pixel values are normalized to [0,1], MAX = 1.

#### Mean Absolute Error (MAE)
```
MAE = (1/N) * Σ|I_enhanced[i] - I_original[i]|
```

#### Noise Level (Standard Deviation)
```
σ = √[(1/N) * Σ(I[i] - μ)²]
```
Where μ is the mean pixel intensity, σ represents image noise level.

#### Brightness Change (Δ Mean)
```
Δ_mean = μ_enhanced - μ_original
```
Positive values indicate increased brightness.

#### Contrast Change (Δ Standard Deviation)
```
Δ_std = σ_enhanced - σ_original
```
Positive values indicate increased contrast.

### Physical Model

#### Underwater Image Formation Model
The system is based on the underwater image degradation model:

```
I(x) = J(x) * t(x) + A * (1 - t(x))
```

Where:
- I(x): Degraded underwater image
- J(x): Clear scene radiance (what we want to recover)
- t(x): Transmission map (light attenuation)
- A: Atmospheric light (global light in water)

#### Model Inversion
To recover J from I:

```
J(x) = (I(x) - A) / t(x) + A
```

Where t(x) is clamped to [0.1, 1.0] to avoid division by very small numbers.

#### Transmission Map
The transmission map models wavelength-dependent light absorption:

```
t(x) = exp(-β * d(x))
```

Where:
- β: Attenuation coefficient (different for R, G, B wavelengths)
- d(x): Scene depth at pixel x

## 📁 Project Structure

```
pugan/
├── checkpoints/           # Trained model weights
│   └── best.pth
├── data/                  # Data loading utilities
│   └── dataset.py
├── model/                 # Neural network models
│   ├── pugan_model.py     # Main PUGAN model implementation
│   └── losses.py          # Loss functions
├── web_backend/           # Flask API server
│   ├── app.py            # Main Flask application
│   ├── requirements.txt  # Backend dependencies
│   ├── gunicorn_config.py # Production server config
│   └── wsgi.py           # WSGI entry point
├── web_frontend/          # Web interface
│   ├── index.html        # Main HTML page
│   ├── script.js         # Frontend JavaScript
│   ├── style.css         # CSS styling
│   └── config.js         # Configuration
├── requirements.txt       # Main dependencies
├── render.yaml           # Deployment configuration
└── README.md            # This file
```

## 🔌 API Reference

### Endpoints

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cuda"
}
```

#### `POST /enhance`
Enhance an underwater image.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `image` file (JPG/PNG)

**Response:**
- Content-Type: `image/jpeg`
- Headers include metrics:
  - `X-MSE`: Mean squared error
  - `X-PSNR`: Peak signal-to-noise ratio
  - `X-MAE`: Mean absolute error
  - `X-DELTA-MEAN`: Brightness change
  - `X-DELTA-STD`: Contrast change
  - `X-NOISE-ORIG`: Original image noise level
  - `X-NOISE-ENH`: Enhanced image noise level

## 🚀 Deployment

### Render Deployment

The project includes `render.yaml` for easy deployment on Render:

```yaml
services:
  - type: web
    name: underwater-enhancement-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: python web_backend/app.py
    healthCheckPath: /health
```

### Local Production Server

```bash
cd web_backend
gunicorn --config gunicorn_config.py wsgi:app
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Inspired by the PUGAN paper: "Physical Model-Guided Underwater Image Enhancement Using Generative Adversarial Networks"
- Built with PyTorch, Flask, and modern web technologies
- Thanks to the underwater imaging research community

## 📞 Support

If you encounter issues or have questions:

1. Check the health endpoint: `GET /health`
2. Verify model checkpoint exists in `checkpoints/best.pth`
3. Ensure all dependencies are installed
4. Check browser console for frontend errors
5. Review backend logs for server errors

## 👤 Author

Md Zaid Alam   
GitHub: https://github.com/mdzaid-alam

---

**Note**: This is a software-only system. No hardware sensors or external devices are required. The model runs entirely on CPU or GPU depending on availability.</content>
<parameter name="filePath">f:\pugan\README.md

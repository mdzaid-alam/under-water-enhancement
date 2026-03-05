// Configuration
// Load config.js if available, otherwise use default
const API_URL = window.API_URL || 'http://localhost:5000';

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const processingSection = document.getElementById('processingSection');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const originalImage = document.getElementById('originalImage');
const enhancedImage = document.getElementById('enhancedImage');
const downloadBtn = document.getElementById('downloadBtn');
const newImageBtn = document.getElementById('newImageBtn');
const retryBtn = document.getElementById('retryBtn');
const errorText = document.getElementById('errorText');

// Metrics UI elements
const metricsSection = document.getElementById('metricsSection');
const mseValue = document.getElementById('mseValue');
const psnrValue = document.getElementById('psnrValue');
const maeValue = document.getElementById('maeValue');
const meanDiffValue = document.getElementById('meanDiffValue');
const contrastDiffValue = document.getElementById('contrastDiffValue');
const noiseOrigValue = document.getElementById('noiseOrigValue');
const noiseEnhValue = document.getElementById('noiseEnhValue');
const noiseReductionValue = document.getElementById('noiseReductionValue');

// Metrics tabs / panels
const tabPerImage = document.getElementById('tabPerImage');
const tabBenchmarks = document.getElementById('tabBenchmarks');
const perImagePanel = document.getElementById('perImageMetrics');
const paperBenchmarksPanel = document.getElementById('paperBenchmarks');

let currentEnhancedImageBlob = null;
let currentMetrics = null;
let currentMetricsMode = 'perImage';

// Event listeners
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
downloadBtn.addEventListener('click', handleDownload);
newImageBtn.addEventListener('click', resetUI);
retryBtn.addEventListener('click', resetUI);

if (tabPerImage && tabBenchmarks) {
    tabPerImage.addEventListener('click', () => setMetricsMode('perImage'));
    tabBenchmarks.addEventListener('click', () => setMetricsMode('benchmarks'));
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('Please select an image file (JPG, PNG, etc.)');
        return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showError('File size must be less than 10MB');
        return;
    }

    // Show original image
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage.src = e.target.result;
        hideAllSections();
        processingSection.style.display = 'block';
        
        // Send to backend
        enhanceImage(file);
    };
    reader.readAsDataURL(file);
}

async function enhanceImage(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);

        let response;
        try {
            response = await fetch(`${API_URL}/enhance`, {
                method: 'POST',
                body: formData
            });
        } catch (networkError) {
            console.error('Network error:', networkError);
            showError(`Cannot connect to backend at ${API_URL}. Start the server with: cd web_backend && python app.py`);
            return;
        }

        if (!response.ok) {
            let errorMessage = `Server error: ${response.status}`;
            try {
                const text = await response.text();
                let json = null;
                try {
                    json = JSON.parse(text);
                } catch (_) {
                    if (text && text.length < 400 && !text.trimStart().startsWith('<')) {
                        errorMessage = text;
                    } else if (response.status === 500 && text.trimStart().startsWith('<')) {
                        errorMessage = 'Server error: 500. Check the terminal where you ran "python app.py" for the actual error.';
                    }
                }
                if (json && typeof json.error === 'string') {
                    errorMessage = json.error;
                }
            } catch (_) {
                errorMessage += ' Check the backend terminal for details.';
            }
            throw new Error(errorMessage);
        }

        // Get enhanced image as blob
        const blob = await response.blob();
        currentEnhancedImageBlob = blob;

        // Display enhanced image
        const imageUrl = URL.createObjectURL(blob);
        enhancedImage.onload = () => {
            // Prefer backend metrics if headers are present; otherwise compute them on the client.
            const headerMetrics = {
                mse: response.headers.get('X-MSE'),
                psnr: response.headers.get('X-PSNR'),
                mae: response.headers.get('X-MAE'),
                deltaMean: response.headers.get('X-DELTA-MEAN'),
                deltaStd: response.headers.get('X-DELTA-STD'),
                noiseOrig: response.headers.get('X-NOISE-ORIG'),
                noiseEnh: response.headers.get('X-NOISE-ENH'),
            };

            const hasHeaderMetrics =
                headerMetrics.mse ||
                headerMetrics.psnr ||
                headerMetrics.mae ||
                headerMetrics.deltaMean ||
                headerMetrics.deltaStd;

            if (hasHeaderMetrics) {
                currentMetrics = headerMetrics;
                updateMetricsUI();
            } else {
                computeClientMetrics();
            }
        };
        enhancedImage.src = imageUrl;

        // Show results
        hideAllSections();
        resultsSection.style.display = 'block';

    } catch (error) {
        console.error('Enhancement error:', error);
        showError(`Enhancement failed: ${error.message}`);
    }
}

function handleDownload() {
    if (!currentEnhancedImageBlob) {
        showError('No enhanced image available');
        return;
    }

    const url = URL.createObjectURL(currentEnhancedImageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enhanced_underwater_image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function showError(message) {
    errorText.textContent = message;
    hideAllSections();
    errorSection.style.display = 'block';
}

function resetUI() {
    hideAllSections();
    fileInput.value = '';
    originalImage.src = '';
    enhancedImage.src = '';
    currentMetrics = null;
    updateMetricsUI();
    setMetricsMode('perImage');
    currentEnhancedImageBlob = null;
    if (currentEnhancedImageBlob) {
        URL.revokeObjectURL(currentEnhancedImageBlob);
    }
}

function hideAllSections() {
    processingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
}

function updateMetricsUI() {
    if (!metricsSection) return;

    // Keep the section visible so users can always access paper benchmarks;
    // just reset the numeric values if metrics are missing.
    if (
        currentMetrics &&
        (currentMetrics.mse || currentMetrics.psnr || currentMetrics.mae)
    ) {
        if (mseValue) mseValue.textContent = formatMetric(currentMetrics.mse);
        if (psnrValue) psnrValue.textContent = formatMetric(currentMetrics.psnr);
        if (maeValue) maeValue.textContent = formatMetric(currentMetrics.mae);
        if (meanDiffValue) meanDiffValue.textContent = formatMetric(currentMetrics.deltaMean);
        if (contrastDiffValue) contrastDiffValue.textContent = formatMetric(currentMetrics.deltaStd);
        if (noiseOrigValue) noiseOrigValue.textContent = currentMetrics.noiseOrig != null ? formatMetric(currentMetrics.noiseOrig) : '--';
        if (noiseEnhValue) noiseEnhValue.textContent = currentMetrics.noiseEnh != null ? formatMetric(currentMetrics.noiseEnh) : '--';
        if (noiseReductionValue) {
            if (currentMetrics.noiseOrig != null && currentMetrics.noiseEnh != null && currentMetrics.noiseOrig > 0) {
                const reduction = (currentMetrics.noiseOrig - currentMetrics.noiseEnh) / currentMetrics.noiseOrig;
                noiseReductionValue.textContent = formatPercent(reduction);
            } else {
                noiseReductionValue.textContent = '--';
            }
        }
    } else {
        if (mseValue) mseValue.textContent = '--';
        if (psnrValue) psnrValue.textContent = '--';
        if (maeValue) maeValue.textContent = '--';
        if (meanDiffValue) meanDiffValue.textContent = '--';
        if (contrastDiffValue) contrastDiffValue.textContent = '--';
        if (noiseOrigValue) noiseOrigValue.textContent = '--';
        if (noiseEnhValue) noiseEnhValue.textContent = '--';
        if (noiseReductionValue) noiseReductionValue.textContent = '--';
    }
}

function formatMetric(raw) {
    if (!raw) return '--';
    const value = parseFloat(raw);
    if (!isFinite(value)) return '∞';
    if (Math.abs(value) >= 100 || Math.abs(value) < 0.001) {
        return value.toExponential(2);
    }
    return value.toFixed(4);
}

function formatPercent(fraction) {
    if (fraction == null || !isFinite(fraction)) return '--';
    return `${(fraction * 100).toFixed(1)}%`;
}

function computeClientMetrics() {
    try {
        if (!originalImage || !enhancedImage || !originalImage.complete || !enhancedImage.complete) {
            return;
        }

        const sampleSize = 256;
        const width = sampleSize;
        const height = sampleSize;

        const canvasOrig = document.createElement('canvas');
        const canvasEnh = document.createElement('canvas');
        canvasOrig.width = canvasEnh.width = width;
        canvasOrig.height = canvasEnh.height = height;

        const ctxOrig = canvasOrig.getContext('2d');
        const ctxEnh = canvasEnh.getContext('2d');
        if (!ctxOrig || !ctxEnh) return;

        ctxOrig.drawImage(originalImage, 0, 0, width, height);
        ctxEnh.drawImage(enhancedImage, 0, 0, width, height);

        const dataOrig = ctxOrig.getImageData(0, 0, width, height).data;
        const dataEnh = ctxEnh.getImageData(0, 0, width, height).data;

        const totalPixels = width * height;
        const totalChannels = totalPixels * 3; // ignore alpha

        let mse = 0;
        let mae = 0;
        let origSum = 0;
        let enhSum = 0;
        let origSqSum = 0;
        let enhSqSum = 0;

        for (let i = 0, j = 0; i < totalPixels; i++, j += 4) {
            for (let c = 0; c < 3; c++) {
                const vOrig = dataOrig[j + c] / 255;
                const vEnh = dataEnh[j + c] / 255;
                const diff = vEnh - vOrig;

                mse += diff * diff;
                mae += Math.abs(diff);

                origSum += vOrig;
                enhSum += vEnh;
                origSqSum += vOrig * vOrig;
                enhSqSum += vEnh * vEnh;
            }
        }

        mse /= totalChannels;
        mae /= totalChannels;

        const origMean = origSum / totalChannels;
        const enhMean = enhSum / totalChannels;

        const origVar = Math.max(origSqSum / totalChannels - origMean * origMean, 0);
        const enhVar = Math.max(enhSqSum / totalChannels - enhMean * enhMean, 0);

        const origStd = Math.sqrt(origVar);
        const enhStd = Math.sqrt(enhVar);

        const deltaMean = enhMean - origMean;
        const deltaStd = enhStd - origStd;

        const psnr = mse > 0 ? 10 * Math.log10(1 / mse) : Infinity;

        currentMetrics = {
            mse,
            psnr,
            mae,
            deltaMean,
            deltaStd,
            noiseOrig: origStd,
            noiseEnh: enhStd,
        };

        updateMetricsUI();
    } catch (error) {
        console.error('Client-side metric computation failed:', error);
    }
}

function setMetricsMode(mode) {
    currentMetricsMode = mode;
    if (!tabPerImage || !tabBenchmarks || !perImagePanel || !paperBenchmarksPanel) {
        return;
    }

    const isPerImage = mode === 'perImage';

    tabPerImage.classList.toggle('active', isPerImage);
    tabBenchmarks.classList.toggle('active', !isPerImage);

    perImagePanel.style.display = isPerImage ? 'block' : 'none';
    paperBenchmarksPanel.style.display = isPerImage ? 'none' : 'block';
}

// Check backend health on load
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_URL}/health`);
        const data = await response.json();
        if (data.model_loaded) {
            console.log('✅ Backend is ready and model is loaded');
            // Show success message to user
            const uploadHint = document.querySelector('.upload-hint');
            if (uploadHint) {
                uploadHint.textContent = 'Backend connected! Ready to enhance images.';
                uploadHint.style.color = '#4CAF50';
            }
        } else {
            console.warn('⚠️ Backend is running but model is not loaded');
            showError('Backend is running but model is not loaded. Please check the server.');
        }
    } catch (error) {
        console.error('❌ Backend health check failed:', error);
        const uploadHint = document.querySelector('.upload-hint');
        if (uploadHint) {
            uploadHint.textContent = `⚠️ Backend not connected. Start server: cd web_backend && python app.py (expects ${API_URL})`;
            uploadHint.style.color = '#f44336';
        }
    }
}

// Check health on page load
checkBackendHealth();



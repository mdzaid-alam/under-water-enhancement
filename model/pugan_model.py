"""
PUGAN-inspired Physical Model-Guided Underwater Image Enhancement Model

This module implements a lightweight, software-only underwater image enhancement
model inspired by PUGAN (Physical Model-Guided Underwater Image Enhancement Using GAN).

The model follows a physical model-guided pipeline:
1. Estimate scene depth and wavelength-dependent light attenuation
2. Compute transmission map for underwater light absorption/scattering
3. Perform physical model inversion for color correction
4. Apply degradation-aware refinement
5. Output enhanced underwater image
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class DepthEstimationModule(nn.Module):
    """
    Estimates scene depth from underwater images.
    Depth information helps model wavelength-dependent light attenuation.
    """
    def __init__(self):
        super(DepthEstimationModule, self).__init__()
        self.conv1 = nn.Conv2d(3, 32, 3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.conv3 = nn.Conv2d(64, 64, 3, padding=1)
        self.conv4 = nn.Conv2d(64, 32, 3, padding=1)
        self.conv5 = nn.Conv2d(32, 1, 3, padding=1)
        self.relu = nn.ReLU(inplace=True)
        
    def forward(self, x):
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        x = self.relu(self.conv3(x))
        x = self.relu(self.conv4(x))
        depth = torch.sigmoid(self.conv5(x))  # Normalized depth [0, 1]
        return depth


class TransmissionMapModule(nn.Module):
    """
    Computes transmission map that models underwater light absorption and scattering.
    Transmission map is wavelength-dependent (different for R, G, B channels).
    """
    def __init__(self):
        super(TransmissionMapModule, self).__init__()
        self.conv1 = nn.Conv2d(4, 64, 3, padding=1)  # RGB + depth
        self.conv2 = nn.Conv2d(64, 128, 3, padding=1)
        self.conv3 = nn.Conv2d(128, 128, 3, padding=1)
        self.conv4 = nn.Conv2d(128, 64, 3, padding=1)
        self.conv5 = nn.Conv2d(64, 3, 3, padding=1)  # RGB transmission
        self.relu = nn.ReLU(inplace=True)
        
    def forward(self, rgb, depth):
        x = torch.cat([rgb, depth], dim=1)
        x = self.relu(self.conv1(x))
        x = self.relu(self.conv2(x))
        x = self.relu(self.conv3(x))
        x = self.relu(self.conv4(x))
        transmission = torch.sigmoid(self.conv5(x))  # [0, 1] for each channel
        return transmission


class PhysicalModelInversion(nn.Module):
    """
    Performs physical model inversion to generate color-corrected intermediate image.
    Uses the transmission map to invert the underwater degradation model.
    """
    def __init__(self):
        super(PhysicalModelInversion, self).__init__()
        # Atmospheric light estimation (global)
        self.global_pool = nn.AdaptiveAvgPool2d(1)
        self.fc_atm = nn.Linear(3, 3)
        
    def forward(self, degraded, transmission):
        """
        Invert physical model: J = (I - A) / t + A
        where I is degraded image, A is atmospheric light, t is transmission
        """
        # Estimate atmospheric light (brightest pixels, typically)
        # Simplified: use global average as base, then refine
        atm_base = self.global_pool(degraded).squeeze(-1).squeeze(-1)
        atm_light = torch.sigmoid(self.fc_atm(atm_base))
        atm_light = atm_light.view(-1, 3, 1, 1)
        
        # Ensure transmission is not too small to avoid division issues
        transmission = torch.clamp(transmission, min=0.1, max=1.0)
        
        # Physical model inversion
        corrected = (degraded - atm_light) / transmission + atm_light
        corrected = torch.clamp(corrected, 0, 1)
        
        return corrected, atm_light


class DegradationAwareRefinement(nn.Module):
    """
    Applies degradation-aware refinement that focuses more on severely degraded
    regions while preserving structure and texture in less degraded areas.
    """
    def __init__(self):
        super(DegradationAwareRefinement, self).__init__()
        # U-Net like architecture for refinement
        # Encoder
        self.enc1 = nn.Conv2d(3, 64, 3, padding=1)
        self.enc2 = nn.Conv2d(64, 128, 3, padding=1, stride=2)
        self.enc3 = nn.Conv2d(128, 256, 3, padding=1, stride=2)
        
        # Bottleneck
        self.bottleneck = nn.Conv2d(256, 256, 3, padding=1)
        
        # Decoder with skip connections
        self.dec1 = nn.Conv2d(256 + 256, 128, 3, padding=1)
        self.dec2 = nn.Conv2d(128 + 128, 64, 3, padding=1)
        self.dec3 = nn.Conv2d(64 + 64, 32, 3, padding=1)
        self.dec4 = nn.Conv2d(32, 3, 3, padding=1)
        
        self.upsample = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=False)
        self.relu = nn.ReLU(inplace=True)
        
        # Degradation attention map
        self.attention = nn.Sequential(
            nn.Conv2d(3, 32, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 1, 3, padding=1),
            nn.Sigmoid()
        )
        
    def forward(self, corrected, degraded):
        # Compute degradation attention (where to focus more)
        degradation_map = self.attention(degraded)
        
        # Encoder
        e1 = self.relu(self.enc1(corrected))
        e2 = self.relu(self.enc2(e1))
        e3 = self.relu(self.enc3(e2))
        
        # Bottleneck
        b = self.relu(self.bottleneck(e3))
        
        # Decoder with skip connections
        # Upsample and crop/pad to match skip connection sizes
        d1 = self.upsample(b)
        # Handle size mismatch by cropping or padding
        if d1.shape[2:] != e3.shape[2:]:
            d1 = F.interpolate(d1, size=e3.shape[2:], mode='bilinear', align_corners=False)
        d1 = torch.cat([d1, e3], dim=1)
        d1 = self.relu(self.dec1(d1))
        
        d2 = self.upsample(d1)
        if d2.shape[2:] != e2.shape[2:]:
            d2 = F.interpolate(d2, size=e2.shape[2:], mode='bilinear', align_corners=False)
        d2 = torch.cat([d2, e2], dim=1)
        d2 = self.relu(self.dec2(d2))
        
        d3 = self.upsample(d2)
        if d3.shape[2:] != e1.shape[2:]:
            d3 = F.interpolate(d3, size=e1.shape[2:], mode='bilinear', align_corners=False)
        d3 = torch.cat([d3, e1], dim=1)
        d3 = self.relu(self.dec3(d3))
        
        refined = torch.sigmoid(self.dec4(d3))
        
        # Ensure refined output matches input size
        if refined.shape[2:] != corrected.shape[2:]:
            refined = F.interpolate(refined, size=corrected.shape[2:], mode='bilinear', align_corners=False)
        
        # Apply degradation-aware weighting
        # More refinement in degraded regions, preserve structure in less degraded areas
        enhanced = corrected * (1 - degradation_map) + refined * degradation_map
        
        return enhanced


class PUGANModel(nn.Module):
    """
    Complete PUGAN-inspired underwater image enhancement model.
    
    Pipeline:
    1. Depth estimation from input image
    2. Transmission map computation (wavelength-dependent)
    3. Physical model inversion for color correction
    4. Degradation-aware refinement
    5. Final enhanced image
    """
    def __init__(self):
        super(PUGANModel, self).__init__()
        self.depth_estimator = DepthEstimationModule()
        self.transmission_estimator = TransmissionMapModule()
        self.physical_inverter = PhysicalModelInversion()
        self.refinement_net = DegradationAwareRefinement()
        
    def forward(self, degraded_image):
        """
        Forward pass through the complete enhancement pipeline.
        
        Args:
            degraded_image: Input underwater image [B, 3, H, W] in range [0, 1]
            
        Returns:
            enhanced_image: Enhanced output image [B, 3, H, W] in range [0, 1]
            intermediate_outputs: Dict with intermediate results for loss computation
        """
        # Step 1: Estimate depth
        depth = self.depth_estimator(degraded_image)
        
        # Step 2: Compute transmission map
        transmission = self.transmission_estimator(degraded_image, depth)
        
        # Step 3: Physical model inversion
        corrected, atm_light = self.physical_inverter(degraded_image, transmission)
        
        # Step 4: Degradation-aware refinement
        enhanced = self.refinement_net(corrected, degraded_image)
        
        intermediate_outputs = {
            'depth': depth,
            'transmission': transmission,
            'corrected': corrected,
            'atmospheric_light': atm_light
        }
        
        return enhanced, intermediate_outputs


def create_model(device='cuda'):
    """Create and initialize the PUGAN model."""
    model = PUGANModel()
    model = model.to(device)
    return model


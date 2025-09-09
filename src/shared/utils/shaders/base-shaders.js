/**
 * Base Shaders - Core vertex and fragment shaders for computer vision operations
 */

// Standard vertex shader for full-screen quad processing
export const VERTEX_SHADER_FULLSCREEN = `#version 300 es
precision highp float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}`;

// WebGL1 fallback vertex shader
export const VERTEX_SHADER_FULLSCREEN_V1 = `
precision highp float;

attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
}`;

// RGB to grayscale conversion shader
export const FRAGMENT_SHADER_GRAYSCALE = `#version 300 es
precision highp float;

uniform sampler2D u_image;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec3 rgb = texture(u_image, v_texCoord).rgb;
    float gray = dot(rgb, vec3(0.299, 0.587, 0.114));
    fragColor = vec4(gray, gray, gray, 1.0);
}`;

export const FRAGMENT_SHADER_GRAYSCALE_V1 = `
precision highp float;

uniform sampler2D u_image;
varying vec2 v_texCoord;

void main() {
    vec3 rgb = texture2D(u_image, v_texCoord).rgb;
    float gray = dot(rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(gray, gray, gray, 1.0);
}`;

// Gaussian blur shader
export const FRAGMENT_SHADER_BLUR = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_sigma;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;
    vec3 color = vec3(0.0);
    float weight = 0.0;
    
    int radius = int(u_sigma * 2.0);
    
    for (int x = -radius; x <= radius; x++) {
        for (int y = -radius; y <= radius; y++) {
            vec2 offset = vec2(float(x), float(y)) * texel;
            float distance = length(offset);
            float w = exp(-distance * distance / (2.0 * u_sigma * u_sigma));
            
            color += texture(u_image, v_texCoord + offset).rgb * w;
            weight += w;
        }
    }
    
    fragColor = vec4(color / weight, 1.0);
}`;

// Sobel edge detection shader
export const FRAGMENT_SHADER_SOBEL = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;
    
    // Sample surrounding pixels
    float tl = texture(u_image, v_texCoord + texel * vec2(-1.0, -1.0)).r;
    float tm = texture(u_image, v_texCoord + texel * vec2( 0.0, -1.0)).r;
    float tr = texture(u_image, v_texCoord + texel * vec2( 1.0, -1.0)).r;
    float ml = texture(u_image, v_texCoord + texel * vec2(-1.0,  0.0)).r;
    float mm = texture(u_image, v_texCoord + texel * vec2( 0.0,  0.0)).r;
    float mr = texture(u_image, v_texCoord + texel * vec2( 1.0,  0.0)).r;
    float bl = texture(u_image, v_texCoord + texel * vec2(-1.0,  1.0)).r;
    float bm = texture(u_image, v_texCoord + texel * vec2( 0.0,  1.0)).r;
    float br = texture(u_image, v_texCoord + texel * vec2( 1.0,  1.0)).r;
    
    // Apply Sobel operators
    float sobelX = (tr + 2.0*mr + br) - (tl + 2.0*ml + bl);
    float sobelY = (bl + 2.0*bm + br) - (tl + 2.0*tm + tr);
    
    float magnitude = sqrt(sobelX*sobelX + sobelY*sobelY);
    fragColor = vec4(magnitude, magnitude, magnitude, 1.0);
}`;

// Integral image computation shader (first pass - horizontal)
export const FRAGMENT_SHADER_INTEGRAL_H = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texel = vec2(1.0 / u_resolution.x, 0.0);
    float sum = 0.0;
    
    // Sum horizontally from left edge to current position
    for (int i = 0; i < int(u_resolution.x); i++) {
        vec2 sampleCoord = vec2(float(i) / u_resolution.x, v_texCoord.y);
        if (sampleCoord.x <= v_texCoord.x) {
            sum += texture(u_image, sampleCoord).r;
        }
    }
    
    fragColor = vec4(sum, sum, sum, 1.0);
}`;

// Histogram equalization shader
export const FRAGMENT_SHADER_HISTOGRAM_EQ = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_histogram;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_image, v_texCoord).rgb;
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    
    // Lookup equalized value from histogram texture
    float equalized = texture(u_histogram, vec2(gray, 0.5)).r;
    
    fragColor = vec4(equalized, equalized, equalized, 1.0);
}`;

// Template matching correlation shader
export const FRAGMENT_SHADER_TEMPLATE_MATCH = `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_template;
uniform vec2 u_resolution;
uniform vec2 u_templateSize;

in vec2 v_texCoord;
out vec4 fragColor;

void main() {
    vec2 texel = 1.0 / u_resolution;
    vec2 templateTexel = 1.0 / u_templateSize;
    
    float correlation = 0.0;
    float normalization = 0.0;
    
    // Calculate normalized cross-correlation
    for (int x = 0; x < int(u_templateSize.x); x++) {
        for (int y = 0; y < int(u_templateSize.y); y++) {
            vec2 imageOffset = vec2(float(x), float(y)) * texel;
            vec2 templateCoord = vec2(float(x), float(y)) * templateTexel;
            
            float imageVal = texture(u_image, v_texCoord + imageOffset).r;
            float templateVal = texture(u_template, templateCoord).r;
            
            correlation += imageVal * templateVal;
            normalization += templateVal * templateVal;
        }
    }
    
    float score = correlation / sqrt(normalization);
    fragColor = vec4(score, score, score, 1.0);
}`;

/**
 * Shader compilation helper function
 */
export function getShaderSource(name, isWebGL2 = true) {
  const shaders = {
    vertex_fullscreen: isWebGL2 ? VERTEX_SHADER_FULLSCREEN : VERTEX_SHADER_FULLSCREEN_V1,
    fragment_grayscale: isWebGL2 ? FRAGMENT_SHADER_GRAYSCALE : FRAGMENT_SHADER_GRAYSCALE_V1,
    fragment_blur: FRAGMENT_SHADER_BLUR,
    fragment_sobel: FRAGMENT_SHADER_SOBEL,
    fragment_integral_h: FRAGMENT_SHADER_INTEGRAL_H,
    fragment_histogram_eq: FRAGMENT_SHADER_HISTOGRAM_EQ,
    fragment_template_match: FRAGMENT_SHADER_TEMPLATE_MATCH
  };
    
  const source = shaders[name];
  if (!source) {
    throw new Error(`Shader '${name}' not found`);
  }
    
  return source;
}

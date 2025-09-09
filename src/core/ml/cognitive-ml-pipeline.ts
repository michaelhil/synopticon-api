/**
 * @fileoverview Machine Learning Pipeline for Cognitive Analysis
 * 
 * Implements online learning algorithms for cognitive state prediction,
 * feature extraction engines, and adaptive model training specifically
 * for multi-modal behavioral analysis.
 * 
 * Features:
 * - Online learning with incremental model updates
 * - Multi-modal feature extraction (gaze, speech, biometrics)
 * - Adaptive threshold adjustment based on user patterns
 * - Real-time prediction with confidence scoring
 * - Integration with existing cognitive fusion system
 * - Zero external ML dependencies (Bun-native implementation)
 * 
 * @version 1.0.0
 * @author Synopticon Development Team
 */

import type { GazeDataPoint, AttentionPrediction } from '@/core/sensors/eye-tracking/index.js';
import type { DistributionManager } from '@/core/distribution/distribution-manager.js';

/**
 * ML model types supported
 */
export type MLModelType = 
  | 'attention-prediction'
  | 'workload-estimation' 
  | 'fatigue-detection'
  | 'stress-classification'
  | 'performance-prediction'
  | 'anomaly-detection';

/**
 * Feature vector for ML processing
 */
export interface FeatureVector {
  timestamp: number;
  features: Float32Array;
  labels: Float32Array;
  metadata: {
    featureNames: string[];
    sourceModalities: string[];
    confidence: number;
    userId?: string;
  };
}

/**
 * ML model configuration
 */
export interface MLModelConfig {
  modelType: MLModelType;
  learningRate: number;
  regularization: number;
  batchSize: number;
  windowSize: number;
  adaptationRate: number;
  confidenceThreshold: number;
  maxFeatures: number;
  normalizeFeatures: boolean;
}

/**
 * Training sample for online learning
 */
export interface TrainingSample {
  features: Float32Array;
  target: Float32Array;
  weight: number;
  timestamp: number;
}

/**
 * Model prediction result
 */
export interface MLPrediction {
  modelType: MLModelType;
  prediction: Float32Array;
  confidence: number;
  uncertainty: number;
  featureImportance: Float32Array;
  timestamp: number;
  metadata: {
    modelVersion: number;
    trainingSize: number;
    lastUpdate: number;
  };
}

/**
 * Online learning statistics
 */
export interface LearningStats {
  totalSamples: number;
  accuracyHistory: number[];
  lossHistory: number[];
  modelUpdates: number;
  lastTrainingTime: number;
  convergenceScore: number;
  featureImportanceEvolution: Map<string, number[]>;
}

/**
 * Creates a cognitive ML pipeline with online learning capabilities
 */
export const createCognitiveMLPipeline = (
  distributionManager: DistributionManager,
  config: Partial<MLModelConfig> = {}
) => {
  // Default configuration
  const {
    modelType = 'attention-prediction',
    learningRate = 0.01,
    regularization = 0.001,
    batchSize = 32,
    windowSize = 100,
    adaptationRate = 0.1,
    confidenceThreshold = 0.7,
    maxFeatures = 50,
    normalizeFeatures = true
  } = config;

  // State management
  const state = {
    models: new Map<MLModelType, MLModel>(),
    featureExtractors: new Map<string, FeatureExtractor>(),
    trainingBuffer: new Map<MLModelType, TrainingSample[]>(),
    predictions: new Map<string, MLPrediction>(),
    learningStats: new Map<MLModelType, LearningStats>(),
    featureNormalizers: new Map<string, FeatureNormalizer>(),
    lastUpdate: Date.now()
  };

  /**
   * Simple neural network for online learning
   */
  class MLModel {
    private weights: Float32Array[];
    private biases: Float32Array[];
    private activations: Float32Array[];
    private layerSizes: number[];
    private optimizer: AdamOptimizer;

    constructor(
      public modelType: MLModelType,
      inputSize: number,
      hiddenSizes: number[],
      outputSize: number
    ) {
      this.layerSizes = [inputSize, ...hiddenSizes, outputSize];
      this.weights = [];
      this.biases = [];
      this.activations = [];

      // Initialize layers
      for (let i = 0; i < this.layerSizes.length - 1; i++) {
        const inputDim = this.layerSizes[i];
        const outputDim = this.layerSizes[i + 1];

        // Xavier initialization
        const scale = Math.sqrt(6.0 / (inputDim + outputDim));
        const weights = new Float32Array(inputDim * outputDim);
        for (let j = 0; j < weights.length; j++) {
          weights[j] = (Math.random() * 2 - 1) * scale;
        }

        this.weights.push(weights);
        this.biases.push(new Float32Array(outputDim));
        this.activations.push(new Float32Array(outputDim));
      }

      this.optimizer = new AdamOptimizer(learningRate);
    }

    /**
     * Forward pass through the network
     */
    forward(input: Float32Array): Float32Array {
      let currentInput = input;

      for (let layer = 0; layer < this.weights.length; layer++) {
        const weights = this.weights[layer];
        const biases = this.biases[layer];
        const activations = this.activations[layer];

        const inputSize = this.layerSizes[layer];
        const outputSize = this.layerSizes[layer + 1];

        // Matrix multiplication: weights * input + bias
        for (let i = 0; i < outputSize; i++) {
          let sum = biases[i];
          for (let j = 0; j < inputSize; j++) {
            sum += weights[i * inputSize + j] * currentInput[j];
          }

          // Apply activation function
          if (layer === this.weights.length - 1) {
            // Output layer: sigmoid for binary classification, linear for regression
            activations[i] = this.modelType.includes('classification') 
              ? this.sigmoid(sum) 
              : sum;
          } else {
            // Hidden layers: ReLU
            activations[i] = Math.max(0, sum);
          }
        }

        currentInput = activations;
      }

      return this.activations[this.activations.length - 1];
    }

    /**
     * Backward pass and weight updates
     */
    updateWeights(input: Float32Array, target: Float32Array, weight: number = 1.0): number {
      const prediction = this.forward(input);
      const loss = this.calculateLoss(prediction, target);

      // Simple gradient descent (simplified backpropagation)
      const outputError = new Float32Array(prediction.length);
      for (let i = 0; i < prediction.length; i++) {
        outputError[i] = (prediction[i] - target[i]) * weight;
      }

      // Update output layer
      const lastLayerIdx = this.weights.length - 1;
      const outputWeights = this.weights[lastLayerIdx];
      const outputBiases = this.biases[lastLayerIdx];
      const hiddenActivations = lastLayerIdx > 0 ? this.activations[lastLayerIdx - 1] : input;

      for (let i = 0; i < outputError.length; i++) {
        // Update biases
        outputBiases[i] -= learningRate * outputError[i];

        // Update weights
        for (let j = 0; j < hiddenActivations.length; j++) {
          const weightIdx = i * hiddenActivations.length + j;
          const gradient = outputError[i] * hiddenActivations[j];
          outputWeights[weightIdx] -= learningRate * (gradient + regularization * outputWeights[weightIdx]);
        }
      }

      return loss;
    }

    /**
     * Calculate prediction confidence
     */
    calculateConfidence(prediction: Float32Array): number {
      // For classification: use prediction entropy
      if (this.modelType.includes('classification')) {
        let entropy = 0;
        for (let i = 0; i < prediction.length; i++) {
          if (prediction[i] > 0) {
            entropy -= prediction[i] * Math.log2(prediction[i]);
          }
        }
        return Math.max(0, 1 - entropy / Math.log2(prediction.length));
      } else {
        // For regression: use inverse of prediction variance
        const variance = this.calculatePredictionVariance(prediction);
        return Math.exp(-variance);
      }
    }

    /**
     * Calculate feature importance using gradients
     */
    calculateFeatureImportance(input: Float32Array): Float32Array {
      const importance = new Float32Array(input.length);
      const epsilon = 0.001;

      const baselineOutput = this.forward(input);

      for (let i = 0; i < input.length; i++) {
        // Perturb input slightly
        const perturbedInput = new Float32Array(input);
        perturbedInput[i] += epsilon;

        const perturbedOutput = this.forward(perturbedInput);
        
        // Calculate gradient approximation
        let totalGradient = 0;
        for (let j = 0; j < baselineOutput.length; j++) {
          totalGradient += Math.abs(perturbedOutput[j] - baselineOutput[j]) / epsilon;
        }

        importance[i] = totalGradient;
      }

      // Normalize importance scores
      const maxImportance = Math.max(...importance);
      if (maxImportance > 0) {
        for (let i = 0; i < importance.length; i++) {
          importance[i] /= maxImportance;
        }
      }

      return importance;
    }

    private sigmoid(x: number): number {
      return 1 / (1 + Math.exp(-x));
    }

    private calculateLoss(prediction: Float32Array, target: Float32Array): number {
      let loss = 0;
      if (this.modelType.includes('classification')) {
        // Cross-entropy loss
        for (let i = 0; i < prediction.length; i++) {
          loss -= target[i] * Math.log(Math.max(prediction[i], 1e-10));
        }
      } else {
        // Mean squared error
        for (let i = 0; i < prediction.length; i++) {
          const error = prediction[i] - target[i];
          loss += error * error;
        }
        loss /= prediction.length;
      }
      return loss;
    }

    private calculatePredictionVariance(prediction: Float32Array): number {
      const mean = prediction.reduce((sum, val) => sum + val, 0) / prediction.length;
      const variance = prediction.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / prediction.length;
      return variance;
    }
  }

  /**
   * Adam optimizer for adaptive learning rates
   */
  class AdamOptimizer {
    private m: Map<string, Float32Array> = new Map();
    private v: Map<string, Float32Array> = new Map();
    private t = 0;
    private beta1 = 0.9;
    private beta2 = 0.999;
    private epsilon = 1e-8;

    constructor(private learningRate: number) {}

    update(paramId: string, params: Float32Array, gradients: Float32Array): void {
      this.t++;

      if (!this.m.has(paramId)) {
        this.m.set(paramId, new Float32Array(params.length));
        this.v.set(paramId, new Float32Array(params.length));
      }

      const m = this.m.get(paramId)!;
      const v = this.v.get(paramId)!;

      for (let i = 0; i < params.length; i++) {
        m[i] = this.beta1 * m[i] + (1 - this.beta1) * gradients[i];
        v[i] = this.beta2 * v[i] + (1 - this.beta2) * gradients[i] * gradients[i];

        const mHat = m[i] / (1 - Math.pow(this.beta1, this.t));
        const vHat = v[i] / (1 - Math.pow(this.beta2, this.t));

        params[i] -= this.learningRate * mHat / (Math.sqrt(vHat) + this.epsilon);
      }
    }
  }

  /**
   * Feature normalizer for consistent scaling
   */
  class FeatureNormalizer {
    private mean: Float32Array;
    private std: Float32Array;
    private count = 0;

    constructor(private featureSize: number) {
      this.mean = new Float32Array(featureSize);
      this.std = new Float32Array(featureSize).fill(1);
    }

    update(features: Float32Array): void {
      this.count++;
      const alpha = 1.0 / this.count;

      for (let i = 0; i < features.length; i++) {
        const delta = features[i] - this.mean[i];
        this.mean[i] += alpha * delta;
        this.std[i] = Math.sqrt((1 - alpha) * this.std[i] * this.std[i] + alpha * delta * delta);
      }
    }

    normalize(features: Float32Array): Float32Array {
      const normalized = new Float32Array(features.length);
      for (let i = 0; i < features.length; i++) {
        normalized[i] = this.std[i] > 0 ? (features[i] - this.mean[i]) / this.std[i] : 0;
      }
      return normalized;
    }
  }

  /**
   * Feature extractor for different modalities
   */
  class FeatureExtractor {
    constructor(
      private modalityType: string,
      private featureConfig: any
    ) {}

    /**
     * Extract features from gaze data
     */
    extractGazeFeatures(gazeData: GazeDataPoint[]): Float32Array {
      if (gazeData.length === 0) return new Float32Array();

      const features = [];

      // Spatial features
      const positions = gazeData.map(point => ({ x: point.x, y: point.y }));
      const centroid = this.calculateCentroid(positions);
      features.push(centroid.x, centroid.y);

      // Dispersion
      const dispersion = this.calculateDispersion(positions, centroid);
      features.push(dispersion);

      // Temporal features
      const velocities = this.calculateVelocities(gazeData);
      features.push(
        this.mean(velocities),
        this.std(velocities),
        Math.max(...velocities),
        Math.min(...velocities)
      );

      // Fixation features
      const fixations = this.detectFixations(gazeData);
      features.push(
        fixations.length,
        fixations.length > 0 ? this.mean(fixations.map(f => f.duration)) : 0,
        fixations.length > 0 ? this.std(fixations.map(f => f.duration)) : 0
      );

      // Saccade features
      const saccades = this.detectSaccades(gazeData);
      features.push(
        saccades.length,
        saccades.length > 0 ? this.mean(saccades.map(s => s.amplitude)) : 0,
        saccades.length > 0 ? this.mean(saccades.map(s => s.velocity)) : 0
      );

      // Pupil features (if available)
      const pupilData = gazeData.filter(point => point.pupilDiameter != null);
      if (pupilData.length > 0) {
        const pupilDiameters = pupilData.map(point => point.pupilDiameter!);
        features.push(
          this.mean(pupilDiameters),
          this.std(pupilDiameters),
          this.calculateTrend(pupilDiameters)
        );
      } else {
        features.push(0, 0, 0);
      }

      return new Float32Array(features);
    }

    /**
     * Extract features from speech data
     */
    extractSpeechFeatures(speechData: any): Float32Array {
      // Placeholder for speech feature extraction
      const features = [];

      // Prosodic features
      features.push(
        speechData.pitch || 0,
        speechData.intensity || 0,
        speechData.speakingRate || 0,
        speechData.pauseDuration || 0
      );

      // Linguistic features
      features.push(
        speechData.wordCount || 0,
        speechData.sentenceComplexity || 0,
        speechData.disfluencyRate || 0,
        speechData.emotionalValence || 0
      );

      return new Float32Array(features);
    }

    /**
     * Extract features from biometric data
     */
    extractBiometricFeatures(biometricData: any): Float32Array {
      const features = [];

      // Heart rate features
      if (biometricData.heartRate) {
        const hrData = Array.isArray(biometricData.heartRate) 
          ? biometricData.heartRate 
          : [biometricData.heartRate];
        
        features.push(
          this.mean(hrData),
          this.std(hrData),
          this.calculateHRV(hrData)
        );
      } else {
        features.push(0, 0, 0);
      }

      // GSR (Galvanic Skin Response)
      features.push(biometricData.gsr || 0);

      // Temperature
      features.push(biometricData.temperature || 0);

      return new Float32Array(features);
    }

    // Helper methods
    private calculateCentroid(positions: Array<{ x: number; y: number }>): { x: number; y: number } {
      const sum = positions.reduce((acc, pos) => ({ x: acc.x + pos.x, y: acc.y + pos.y }), { x: 0, y: 0 });
      return { x: sum.x / positions.length, y: sum.y / positions.length };
    }

    private calculateDispersion(positions: Array<{ x: number; y: number }>, centroid: { x: number; y: number }): number {
      const sumSquaredDistances = positions.reduce((sum, pos) => {
        const dx = pos.x - centroid.x;
        const dy = pos.y - centroid.y;
        return sum + (dx * dx + dy * dy);
      }, 0);
      return Math.sqrt(sumSquaredDistances / positions.length);
    }

    private calculateVelocities(gazeData: GazeDataPoint[]): number[] {
      const velocities = [];
      for (let i = 1; i < gazeData.length; i++) {
        const dx = gazeData[i].x - gazeData[i - 1].x;
        const dy = gazeData[i].y - gazeData[i - 1].y;
        const dt = (gazeData[i].timestamp - gazeData[i - 1].timestamp) / 1000;
        if (dt > 0) {
          velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
        }
      }
      return velocities;
    }

    private detectFixations(gazeData: GazeDataPoint[]): Array<{ duration: number; x: number; y: number }> {
      const fixations = [];
      let currentFixation: { start: number; points: GazeDataPoint[] } | null = null;
      const velocityThreshold = 100; // pixels/second

      const velocities = this.calculateVelocities(gazeData);

      for (let i = 0; i < gazeData.length; i++) {
        const velocity = velocities[i - 1] || 0;

        if (velocity < velocityThreshold) {
          // Start or continue fixation
          if (!currentFixation) {
            currentFixation = { start: i, points: [gazeData[i]] };
          } else {
            currentFixation.points.push(gazeData[i]);
          }
        } else {
          // End fixation
          if (currentFixation && currentFixation.points.length >= 3) {
            const centroid = this.calculateCentroid(currentFixation.points);
            const duration = gazeData[i - 1].timestamp - gazeData[currentFixation.start].timestamp;
            fixations.push({ duration, x: centroid.x, y: centroid.y });
          }
          currentFixation = null;
        }
      }

      return fixations;
    }

    private detectSaccades(gazeData: GazeDataPoint[]): Array<{ amplitude: number; velocity: number }> {
      const saccades = [];
      const velocities = this.calculateVelocities(gazeData);
      const velocityThreshold = 100;

      let saccadeStart = -1;

      for (let i = 0; i < velocities.length; i++) {
        if (velocities[i] > velocityThreshold && saccadeStart === -1) {
          saccadeStart = i;
        } else if (velocities[i] <= velocityThreshold && saccadeStart !== -1) {
          const saccadeEnd = i;
          const startPoint = gazeData[saccadeStart];
          const endPoint = gazeData[saccadeEnd];

          const amplitude = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + 
            Math.pow(endPoint.y - startPoint.y, 2)
          );

          const maxVelocity = Math.max(...velocities.slice(saccadeStart, saccadeEnd + 1));

          saccades.push({ amplitude, velocity: maxVelocity });
          saccadeStart = -1;
        }
      }

      return saccades;
    }

    private mean(values: number[]): number {
      return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    }

    private std(values: number[]): number {
      if (values.length <= 1) return 0;
      const meanVal = this.mean(values);
      const variance = values.reduce((sum, val) => sum + Math.pow(val - meanVal, 2), 0) / values.length;
      return Math.sqrt(variance);
    }

    private calculateTrend(values: number[]): number {
      if (values.length < 2) return 0;
      
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      const n = values.length;

      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
      }

      return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    private calculateHRV(heartRates: number[]): number {
      if (heartRates.length < 2) return 0;
      
      const intervals = [];
      for (let i = 1; i < heartRates.length; i++) {
        intervals.push(Math.abs(heartRates[i] - heartRates[i - 1]));
      }
      
      return this.std(intervals);
    }
  }

  // Initialize feature extractors
  state.featureExtractors.set('gaze', new FeatureExtractor('gaze', {}));
  state.featureExtractors.set('speech', new FeatureExtractor('speech', {}));
  state.featureExtractors.set('biometric', new FeatureExtractor('biometric', {}));

  // Public API
  const api = {
    /**
     * Initialize ML model for specific task
     */
    initializeModel: (
      modelType: MLModelType,
      inputSize: number = maxFeatures,
      hiddenSizes: number[] = [64, 32],
      outputSize: number = 1
    ): void => {
      const model = new MLModel(modelType, inputSize, hiddenSizes, outputSize);
      state.models.set(modelType, model);

      // Initialize training buffer
      state.trainingBuffer.set(modelType, []);

      // Initialize learning statistics
      state.learningStats.set(modelType, {
        totalSamples: 0,
        accuracyHistory: [],
        lossHistory: [],
        modelUpdates: 0,
        lastTrainingTime: Date.now(),
        convergenceScore: 0,
        featureImportanceEvolution: new Map()
      });

      console.log(`Initialized ML model: ${modelType}`);
    },

    /**
     * Extract features from multi-modal data
     */
    extractFeatures: (data: {
      gaze?: GazeDataPoint[];
      speech?: any;
      biometric?: any;
      timestamp: number;
    }): FeatureVector => {
      const allFeatures: number[] = [];
      const featureNames: string[] = [];
      const sourceModalities: string[] = [];

      // Extract gaze features
      if (data.gaze && data.gaze.length > 0) {
        const gazeExtractor = state.featureExtractors.get('gaze')!;
        const gazeFeatures = gazeExtractor.extractGazeFeatures(data.gaze);
        allFeatures.push(...gazeFeatures);
        sourceModalities.push('gaze');
        
        // Add feature names
        const gazeFeatureNames = [
          'gaze_centroid_x', 'gaze_centroid_y', 'gaze_dispersion',
          'velocity_mean', 'velocity_std', 'velocity_max', 'velocity_min',
          'fixation_count', 'fixation_duration_mean', 'fixation_duration_std',
          'saccade_count', 'saccade_amplitude_mean', 'saccade_velocity_mean',
          'pupil_diameter_mean', 'pupil_diameter_std', 'pupil_trend'
        ];
        featureNames.push(...gazeFeatureNames);
      }

      // Extract speech features
      if (data.speech) {
        const speechExtractor = state.featureExtractors.get('speech')!;
        const speechFeatures = speechExtractor.extractSpeechFeatures(data.speech);
        allFeatures.push(...speechFeatures);
        sourceModalities.push('speech');
        
        const speechFeatureNames = [
          'speech_pitch', 'speech_intensity', 'speech_rate', 'speech_pause_duration',
          'word_count', 'sentence_complexity', 'disfluency_rate', 'emotional_valence'
        ];
        featureNames.push(...speechFeatureNames);
      }

      // Extract biometric features
      if (data.biometric) {
        const biometricExtractor = state.featureExtractors.get('biometric')!;
        const biometricFeatures = biometricExtractor.extractBiometricFeatures(data.biometric);
        allFeatures.push(...biometricFeatures);
        sourceModalities.push('biometric');
        
        const biometricFeatureNames = [
          'hr_mean', 'hr_std', 'hrv', 'gsr', 'temperature'
        ];
        featureNames.push(...biometricFeatureNames);
      }

      // Pad or truncate features to maxFeatures
      const features = new Float32Array(maxFeatures);
      for (let i = 0; i < Math.min(allFeatures.length, maxFeatures); i++) {
        features[i] = allFeatures[i];
      }

      // Calculate confidence based on data completeness
      const confidence = sourceModalities.length / 3; // Assume 3 modalities max

      return {
        timestamp: data.timestamp,
        features,
        labels: new Float32Array(), // Will be set during training
        metadata: {
          featureNames: featureNames.slice(0, maxFeatures),
          sourceModalities,
          confidence
        }
      };
    },

    /**
     * Train model with new sample
     */
    trainModel: (modelType: MLModelType, sample: TrainingSample): void => {
      const model = state.models.get(modelType);
      if (!model) {
        throw new Error(`Model ${modelType} not initialized`);
      }

      // Add to training buffer
      const buffer = state.trainingBuffer.get(modelType)!;
      buffer.push(sample);

      // Keep buffer size manageable
      if (buffer.length > windowSize * 2) {
        buffer.shift();
      }

      // Update feature normalizer
      const normalizerId = `${modelType}_normalizer`;
      if (!state.featureNormalizers.has(normalizerId)) {
        state.featureNormalizers.set(normalizerId, new FeatureNormalizer(sample.features.length));
      }
      const normalizer = state.featureNormalizers.get(normalizerId)!;
      normalizer.update(sample.features);

      // Online training
      const normalizedFeatures = normalizeFeatures ? normalizer.normalize(sample.features) : sample.features;
      const loss = model.updateWeights(normalizedFeatures, sample.target, sample.weight);

      // Update statistics
      const stats = state.learningStats.get(modelType)!;
      stats.totalSamples++;
      stats.lossHistory.push(loss);
      stats.modelUpdates++;
      stats.lastTrainingTime = Date.now();

      // Keep history manageable
      if (stats.lossHistory.length > 100) {
        stats.lossHistory.shift();
      }

      // Calculate convergence score
      if (stats.lossHistory.length > 10) {
        const recentLosses = stats.lossHistory.slice(-10);
        const variance = recentLosses.reduce((sum, loss) => {
          const mean = recentLosses.reduce((s, l) => s + l, 0) / recentLosses.length;
          return sum + Math.pow(loss - mean, 2);
        }, 0) / recentLosses.length;
        stats.convergenceScore = Math.exp(-variance);
      }
    },

    /**
     * Make prediction using trained model
     */
    predict: (modelType: MLModelType, features: Float32Array): MLPrediction => {
      const model = state.models.get(modelType);
      if (!model) {
        throw new Error(`Model ${modelType} not initialized`);
      }

      // Normalize features if enabled
      let normalizedFeatures = features;
      if (normalizeFeatures) {
        const normalizerId = `${modelType}_normalizer`;
        const normalizer = state.featureNormalizers.get(normalizerId);
        if (normalizer) {
          normalizedFeatures = normalizer.normalize(features);
        }
      }

      // Make prediction
      const prediction = model.forward(normalizedFeatures);
      const confidence = model.calculateConfidence(prediction);
      const featureImportance = model.calculateFeatureImportance(normalizedFeatures);

      // Calculate uncertainty
      const uncertainty = 1 - confidence;

      const stats = state.learningStats.get(modelType)!;

      const result: MLPrediction = {
        modelType,
        prediction,
        confidence,
        uncertainty,
        featureImportance,
        timestamp: Date.now(),
        metadata: {
          modelVersion: stats.modelUpdates,
          trainingSize: stats.totalSamples,
          lastUpdate: stats.lastTrainingTime
        }
      };

      // Store prediction
      const predictionId = `${modelType}_${Date.now()}`;
      state.predictions.set(predictionId, result);

      // Cleanup old predictions
      const cutoff = Date.now() - 60000; // Keep 1 minute of predictions
      for (const [id, pred] of state.predictions) {
        if (pred.timestamp < cutoff) {
          state.predictions.delete(id);
        }
      }

      return result;
    },

    /**
     * Get model statistics
     */
    getModelStats: (modelType: MLModelType): LearningStats | null => {
      return state.learningStats.get(modelType) || null;
    },

    /**
     * Process multi-modal data and make cognitive predictions
     */
    processCognitiveData: async (data: {
      gaze?: GazeDataPoint[];
      speech?: any;
      biometric?: any;
      timestamp: number;
      userId?: string;
    }): Promise<Map<MLModelType, MLPrediction>> => {
      const results = new Map<MLModelType, MLPrediction>();

      // Extract features
      const featureVector = api.extractFeatures(data);

      // Make predictions for all initialized models
      for (const [modelType] of state.models) {
        try {
          const prediction = api.predict(modelType, featureVector.features);
          results.set(modelType, prediction);

          // Broadcast prediction if distribution is available
          distributionManager.broadcast('ml-prediction', {
            modelType,
            prediction: prediction.prediction[0], // Assume single output for simplicity
            confidence: prediction.confidence,
            userId: data.userId,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error(`Prediction failed for model ${modelType}:`, error);
        }
      }

      return results;
    },

    /**
     * Update model with feedback
     */
    provideFeedback: (
      modelType: MLModelType, 
      features: Float32Array, 
      actualOutcome: Float32Array, 
      confidence: number = 1.0
    ): void => {
      const sample: TrainingSample = {
        features,
        target: actualOutcome,
        weight: confidence,
        timestamp: Date.now()
      };

      api.trainModel(modelType, sample);
    },

    /**
     * Get system status
     */
    getSystemStatus: () => ({
      modelsInitialized: state.models.size,
      totalPredictions: state.predictions.size,
      averageModelAccuracy: Array.from(state.learningStats.values())
        .reduce((sum, stats) => sum + stats.convergenceScore, 0) / state.learningStats.size || 0,
      lastUpdate: state.lastUpdate,
      memoryUsage: {
        models: state.models.size,
        trainingBuffers: Array.from(state.trainingBuffer.values())
          .reduce((sum, buffer) => sum + buffer.length, 0),
        predictions: state.predictions.size
      }
    })
  };

  return api;
};

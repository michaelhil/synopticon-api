# AI Fine-tuning Project Descriptions

## 1. Clinical Speech Analysis Assistant

### Functionality
This model serves as an intelligent speech pathology assistant that can analyze speech patterns, identify potential disorders, and provide detailed clinical insights. It processes acoustic features (fundamental frequency, jitter, shimmer, formants) and transcribed speech to detect markers of neurological conditions like Parkinson's, Alzheimer's, and dysarthria. The system can track disease progression over time, suggest therapeutic interventions, and generate clinical reports. It understands complex relationships between acoustic parameters and pathological conditions, providing explanations in both clinical terminology for professionals and simplified language for patients.

### Base Model
**Mistral-7B-Instruct** or **BioGPT** - Mistral provides strong general reasoning while BioGPT offers medical domain knowledge. For multimodal analysis incorporating audio spectrograms, consider **LLaVA-1.5-7B**.

### Fine-tuning Datasets
- **DementiaBank Pitt Corpus**: 500+ hours of conversations with Alzheimer's patients, including Cookie Theft picture descriptions with clinical annotations
- **TORGO Database**: 23 hours of dysarthric speech from cerebral palsy and ALS patients with parallel recordings from healthy controls
- **Parkinson's Speech Dataset (UCI)**: 1,200+ voice recordings with 26 acoustic features from 40 patients, including sustained vowels and words
- **PC-GITA**: 100 Colombian Spanish speakers (50 Parkinson's) with DDK tasks, monologues, and read texts
- **NCTE Aphasia Corpus**: Post-stroke aphasia speech samples with severity ratings

The model learns to correlate specific acoustic patterns (e.g., reduced vocal intensity, monotone pitch) with conditions, predict UPDRS scores for Parkinson's patients, and distinguish between different types of aphasia from speech characteristics alone.

---

## 2. Behavioral Eye Tracking Interpreter

### Functionality
This vision-language model interprets eye tracking data to understand cognitive states, learning patterns, and attention disorders. It analyzes scanpaths, fixation sequences, pupil dynamics, and saccade patterns to determine what task someone is performing (reading, searching, problem-solving), their expertise level, cognitive load, and potential attention deficits. The model can identify dyslexic reading patterns, predict autism spectrum behaviors from social attention metrics, detect mind-wandering episodes, and assess visual expertise in domains like radiology or art. It provides rich narratives explaining not just what someone looked at, but why, interpreting the strategic and cognitive significance of gaze patterns.

### Base Model
**LLaVA-1.5-7B** or **CLIP-ViT-L/14** fine-tuned with an LLM head - These models can process heatmap visualizations and understand spatial-temporal patterns. Alternative: **Flamingo-3B** for efficient vision-language tasks.

### Fine-tuning Datasets
- **GazeCapture (MIT)**: 2.5 million frames from 1,450 participants looking at mobile devices, with screen content and gaze coordinates
- **OSIE (Object and Semantic Images + Eye-movements)**: 700 images with eye movements from 15 viewers, including semantic object annotations
- **EMVIC (Eye Movements in Visual Information Communication)**: Reading patterns on infographics and visualizations from 200 participants
- **ASD Eye-tracking Dataset**: Gaze patterns from children with autism spectrum disorder vs typically developing, during social scene viewing
- **Schizophrenia Eye-tracking (CNTRICS)**: Smooth pursuit and antisaccade data from 200+ schizophrenia patients

The training enables the model to understand that circular scanpaths indicate visual search, linear patterns suggest reading, erratic movements may indicate confusion, and prolonged fixations on faces versus objects can indicate social attention differences.

---

## 3. Multimodal Biometric Authentication System

### Functionality
This model creates a unified biometric embedding space that can identify individuals from various biometric inputs (face, iris, gait, voice) and assess biometric quality, detect spoofing attempts, and predict demographic attributes. It learns invariant representations robust to aging, lighting changes, and partial occlusions. The system can perform cross-modal matching (matching face to voice), quality-aware fusion of multiple biometrics, and continuous authentication in video streams. It generates confidence scores, identifies when biometrics are compromised or altered, and can detect deepfakes by analyzing subtle inconsistencies across modalities.

### Base Model
**CLIP-ViT-B/32** or **DINOv2-base** for visual features, combined with **Wav2Vec2-base** for voice. These provide strong pre-trained representations for visual and audio modalities. Alternative: **ImageBind** for unified multimodal embeddings.

### Fine-tuning Datasets
- **VoxCeleb2**: 1 million+ utterances from 6,000+ speakers with face tracks, enabling face-voice association learning
- **CASIA-WebFace**: 500,000 images of 10,000 subjects for face recognition across poses and expressions
- **CASIA-Iris-Distance**: 2,567 iris images captured at 3 meters distance, testing long-range identification
- **OU-ISIR Gait Database**: 4,000+ subjects walking patterns with age labels (largest gait dataset)
- **M-AILABS Speech Dataset**: 1,000+ hours of speech in 9 languages for voice biometrics

The model learns to extract identity-preserving features that remain consistent across modalities, understanding that certain gait patterns correlate with age, voice characteristics can reveal stress levels, and iris patterns remain stable over decades.

---

## 4. Emotional Intelligence from Physiology

### Functionality
This temporal transformer model interprets physiological signals (EEG, ECG, GSR, respiration) to understand emotional states, stress levels, and cognitive workload. It performs real-time emotion classification into discrete categories (happy, sad, anxious) and continuous arousal-valence mapping. The system can detect emotional transitions, identify triggers from contextual data, predict emotional responses to stimuli, and distinguish between felt and displayed emotions. It understands complex patterns like anticipatory stress (GSR changes before conscious awareness), cognitive-emotional conflicts in EEG patterns, and can differentiate anxiety from excitement despite similar physiological arousal.

### Base Model
**TimesFormer** or **PatchTST** (Patch Time Series Transformer) - These excel at temporal pattern recognition. For smaller deployments: **TSMixer** or modified **BERT-small** adapted for time series.

### Fine-tuning Datasets
- **DEAP**: 32-channel EEG + peripheral signals from 32 participants watching 40 music videos, with arousal/valence/dominance ratings
- **WESAD (Wearable Stress and Affect)**: Wrist and chest sensors during stress/amusement/meditation from 15 subjects (25 hours total)
- **AMIGOS**: 40 participants watching videos in groups, with EEG, ECG, GSR + social context and personality scores
- **CASE Dataset**: 1,000+ hours of continuous physiological monitoring during daily activities with self-reported emotions
- **MAHNOB-HCI**: Face video + EEG + peripheral physiology during emotion elicitation and implicit tagging experiments

The model learns that increased theta/decreased alpha EEG indicates drowsiness, specific HRV patterns predict panic attacks minutes before onset, and combined GSR+temperature changes indicate genuine versus performed emotions.

---

## 5. Medical Report Generation from Patient Monitoring

### Functionality
This model synthesizes multimodal patient data (vital signs, movement patterns, facial expressions, speech) into comprehensive medical reports and real-time alerts. It monitors continuous streams from ICU/elderly care settings, detecting subtle changes indicating deterioration, fall risk, or medical emergencies. The system generates natural language summaries for shift changes, identifies patterns suggesting UTIs in dementia patients (restlessness + slight temperature elevation), predicts delirium onset from sleep-wake patterns, and detects pain in non-verbal patients through facial micro-expressions. It can explain its reasoning, highlight concerning trends, and adapt its language for different audiences (doctors, nurses, family members).

### Base Model
**ClinicalBERT** or **BioBERT** as the language foundation, combined with **VideoMAE** for visual understanding. Alternative: **Med-Flamingo** for medical vision-language tasks, or **Llama-2-7B** fine-tuned on medical texts.

### Fine-tuning Datasets
- **MIMIC-IV**: ICU data from 50,000+ patients including vitals, notes, and outcomes for learning clinical patterns
- **UNBC-McMaster Shoulder Pain Archive**: Face videos of patients with pain intensity scores for pain detection
- **PhysioNet Sleep-EDF**: Polysomnographic sleep recordings for sleep stage analysis and disturbance detection
- **Dementia Monitoring Dataset**: Continuous monitoring of 100+ dementia patients with agitation/falls annotations
- **RAVDESS + Clinical Context**: Emotional speech/face combined with medical scenarios for bedside manner understanding

The model learns that specific combinations of vital sign trends predict sepsis 6 hours before clinical recognition, certain facial expressions combined with movement patterns indicate unmanaged pain, and changes in speech prosody can indicate medication side effects or infection in elderly patients.
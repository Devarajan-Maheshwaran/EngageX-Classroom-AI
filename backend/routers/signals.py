import logging
import base64
import numpy as np
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import db.py_store as _svc
from agents.signal_aggregator import run_aggregation
from socket_manager import sio

router = APIRouter()
logger = logging.getLogger('engagex.signals')

EMOTION_SCORE = {
    'happy': 90,
    'surprise': 85,
    'neutral': 60,
    'sad': 35,
    'fear': 30,
    'fearful': 30,
    'angry': 20,
    'disgust': 15,
    'disgusted': 15,
}


class SignalPayload(BaseModel):
    session_id:       str
    student_id:       str
    signal_type:      str
    signal_data:      dict
    engagement_score: Optional[float] = None


class VisionPayload(BaseModel):
    session_id:   str
    student_id:   str
    student_name: str = 'Unknown'
    frame_b64:    str


class AudioPayload(BaseModel):
    session_id:   str
    student_id:   str
    student_name: str = 'Unknown'
    audio_b64:    str


@router.post('/', status_code=status.HTTP_201_CREATED)
async def ingest_signal(body: SignalPayload):
    try:
        row = _svc.save_signal(
            session_id=body.session_id,
            student_id=body.student_id,
            signal_type=body.signal_type,
            signal_data=body.signal_data,
            engagement_score=body.engagement_score,
        )
    except Exception as e:
        logger.error(f'ingest_signal: {e}')
        raise HTTPException(500, 'Failed to save signal')
    await sio.emit('signal_ack', {'id': row['id']}, room=body.session_id)
    return {'id': row['id'], 'status': 'saved'}


@router.post('/vision', status_code=status.HTTP_201_CREATED)
async def ingest_vision(body: VisionPayload):
    try:
        import cv2
        img_bytes = base64.b64decode(body.frame_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError('decode failed')
    except Exception:
        raise HTTPException(400, 'Invalid base64 image')

    dominant_emotion = 'neutral'
    engagement_score = 60.0
    looking_away = False

    try:
        from deepface import DeepFace
        result = DeepFace.analyze(frame, actions=['emotion'], enforce_detection=False, silent=True)
        if isinstance(result, list):
            result = result[0] if result else {}
        dominant_emotion = result.get('dominant_emotion', 'neutral')
        engagement_score = float(EMOTION_SCORE.get(dominant_emotion, 60))
        face_confidence = result.get('face_confidence', 1.0)
        looking_away = face_confidence < 0.3
    except Exception as exc:
        logger.warning(f'DeepFace failed: {exc}; using FER fallback')
        try:
            from fer import FER
            detector = FER(mtcnn=False)
            detections = detector.detect_emotions(frame)
            if detections:
                emotions = detections[0].get('emotions', {})
                top = max(emotions, key=emotions.get)
                dominant_emotion = top
                engagement_score = float(EMOTION_SCORE.get(top, 60))
        except Exception as exc2:
            logger.warning(f'FER fallback also failed: {exc2}')

    signal_data = {
        'dominant_emotion': dominant_emotion,
        'looking_away': looking_away,
        'looking_away_ratio': 1.0 if looking_away else 0.0,
    }

    try:
        row = _svc.save_signal(
            session_id=body.session_id,
            student_id=body.student_id,
            signal_type='vision',
            signal_data=signal_data,
            engagement_score=engagement_score,
        )
    except Exception as exc:
        logger.error(f'save vision signal: {exc}')
        raise HTTPException(500, 'Failed to save vision signal')

    agg = run_aggregation(body.session_id, body.student_id, body.student_name)
    if agg.get('alert_type'):
        await sio.emit('engagement:alert', {
            'sessionId': body.session_id,
            'studentId': body.student_id,
            'studentName': body.student_name,
            'type': agg['alert_type'].upper(),
            'message': agg['alert']['message'] if agg.get('alert') else '',
            'fusedScore': agg['fused_score'],
            'source': 'vision',
        }, room=body.session_id)

    await sio.emit('vision_ack', {
        'student_id': body.student_id,
        'dominant_emotion': dominant_emotion,
        'engagement_score': engagement_score,
        'looking_away': looking_away,
    }, room=body.session_id)

    return {
        'dominant_emotion': dominant_emotion,
        'engagement_score': engagement_score,
        'signal_id': row['id'],
    }


@router.post('/audio', status_code=status.HTTP_201_CREATED)
async def ingest_audio(body: AudioPayload):
    try:
        audio_bytes = base64.b64decode(body.audio_b64)
    except Exception:
        raise HTTPException(400, 'Invalid base64 audio')

    transcript = ''
    vocal_emotion = 'neutral'
    engagement_score = 60.0

    try:
        from services.whisper_service import transcribe_audio
        transcript = transcribe_audio(audio_bytes) or ''
    except Exception as exc:
        logger.warning(f'Audio transcription failed: {exc}')

    try:
        from services.vocal_emotion_service import extract_vocal_features, score_from_vocal
        features = extract_vocal_features(audio_bytes)
        if features:
            vocal_emotion = features.get('emotion', 'neutral')
            engagement_score = float(score_from_vocal(features))
    except Exception as exc:
        logger.warning(f'Vocal emotion analysis failed: {exc}')

    emotion_to_score = {
        'happy': 85,
        'calm': 75,
        'engaged': 80,
        'neutral': 60,
        'disengaged': 35,
        'sad': 35,
        'angry': 20,
        'fearful': 25,
    }
    engagement_score = float(emotion_to_score.get(vocal_emotion, engagement_score))

    signal_data = {'transcript': transcript, 'vocal_emotion': vocal_emotion}

    try:
        row = _svc.save_signal(
            session_id=body.session_id,
            student_id=body.student_id,
            signal_type='audio',
            signal_data=signal_data,
            engagement_score=engagement_score,
        )
    except Exception as exc:
        logger.error(f'save audio signal: {exc}')
        raise HTTPException(500, 'Failed to save audio signal')

    agg = run_aggregation(body.session_id, body.student_id, body.student_name)
    if agg.get('alert_type'):
        await sio.emit('engagement:alert', {
            'sessionId': body.session_id,
            'studentId': body.student_id,
            'studentName': body.student_name,
            'type': agg['alert_type'].upper(),
            'message': agg['alert']['message'] if agg.get('alert') else '',
            'fusedScore': agg['fused_score'],
            'source': 'audio',
        }, room=body.session_id)

    return {
        'transcript': transcript,
        'vocal_emotion': vocal_emotion,
        'engagement_score': engagement_score,
        'signal_id': row['id'],
    }


@router.get('/{session_id}/{student_id}', status_code=status.HTTP_200_OK)
def get_signals(session_id: str, student_id: str, limit: int = 20):
    signals = _svc.get_recent_signals(session_id, student_id, limit)
    return {'signals': signals}

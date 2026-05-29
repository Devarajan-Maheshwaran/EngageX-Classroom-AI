import sqlite3
import os
import json
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), '../data/engagex.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_session_state(session_id: str) -> Optional[dict]:
    with get_db() as db:
        session = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if not session:
            return None
        session_dict = dict(session)
        students = db.execute('''
            SELECT s.id, s.display_name as name 
            FROM session_students ss
            JOIN students s ON ss.student_id = s.id
            WHERE ss.session_id = ?
        ''', (session_id,)).fetchall()
        session_dict['students'] = [dict(s) for s in students]
        return session_dict

def get_recent_signals(session_id: str, student_id: str, limit: int = 10) -> list:
    with get_db() as db:
        # We union the 3 signal tables to provide a generic "recent signals" view
        query = '''
            SELECT id, session_id, student_id, ts as created_at, 'text' as signal_type,
                   engagement_score, text, sentiment_label as sentiment, sentiment_score, intent_label as intent, intent_score
            FROM text_signals WHERE session_id = ? AND student_id = ?
            UNION ALL
            SELECT id, session_id, student_id, ts as created_at, 'audio' as signal_type,
                   engagement_score, transcript as text, vocal_emotion as emotion, NULL as sentiment_score, NULL as intent, NULL as intent_score
            FROM audio_signals WHERE session_id = ? AND student_id = ?
            UNION ALL
            SELECT id, session_id, student_id, ts as created_at, 'vision' as signal_type,
                   engagement_score, dominant_emotion as emotion, NULL as sentiment_score, NULL as intent, NULL as intent_score, looking_away
            FROM vision_signals WHERE session_id = ? AND student_id = ?
            ORDER BY created_at DESC LIMIT ?
        '''
        rows = db.execute(query, (session_id, student_id, session_id, student_id, session_id, student_id, limit)).fetchall()
        
        result = []
        for row in rows:
            r = dict(row)
            data = {}
            if r['signal_type'] == 'text':
                data = {'text': r['text'], 'sentiment': r['sentiment'], 'sentiment_score': r['sentiment_score'], 'intent': r['intent'], 'intent_score': r['intent_score']}
            elif r['signal_type'] == 'audio':
                data = {'transcript': r['text'], 'vocal_emotion': r['sentiment']}
            elif r['signal_type'] == 'vision':
                data = {'dominant_emotion': r['sentiment'], 'looking_away': bool(r['intent_score'])}
                
            result.append({
                'id': r['id'],
                'session_id': r['session_id'],
                'student_id': r['student_id'],
                'created_at': r['created_at'],
                'signal_type': r['signal_type'],
                'engagement_score': r['engagement_score'],
                'signal_data': data
            })
        return result

def save_signal(session_id: str, student_id: str, signal_type: str, signal_data: dict, engagement_score: Optional[float] = None) -> dict:
    from datetime import datetime
    import json
    ts = datetime.utcnow().isoformat()
    with get_db() as db:
        cursor = db.cursor()
        if signal_type == 'text':
            cursor.execute('''
                INSERT INTO text_signals (session_id, student_id, ts, text, sentiment_label, sentiment_score, intent_label, intent_score, engagement_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (session_id, student_id, ts, signal_data.get('text'), signal_data.get('sentiment'), signal_data.get('sentimentScore'), signal_data.get('intent'), signal_data.get('intentScore'), engagement_score))
        elif signal_type == 'audio':
            cursor.execute('''
                INSERT INTO audio_signals (session_id, student_id, ts, transcript, vocal_emotion, engagement_score)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (session_id, student_id, ts, signal_data.get('transcript'), signal_data.get('vocal_emotion'), engagement_score))
        elif signal_type == 'vision':
            cursor.execute('''
                INSERT INTO vision_signals (session_id, student_id, ts, dominant_emotion, looking_away, engagement_score)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (session_id, student_id, ts, signal_data.get('dominant_emotion'), int(signal_data.get('looking_away', 0)), engagement_score))
        
        db.commit()
        return {'id': cursor.lastrowid}

def save_alert(session_id: str, student_id: str, alert_type: str, message: str, fused_score: float) -> dict:
    from datetime import datetime
    ts = datetime.utcnow().isoformat()
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute('''
            INSERT INTO engagement_alerts (session_id, student_id, ts, alert_type, message, fused_score)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (session_id, student_id, ts, alert_type, message, fused_score))
        db.commit()
        return {'id': cursor.lastrowid}

def get_alerts(session_id: str, limit: int = 50) -> list:
    with get_db() as db:
        rows = db.execute('''
            SELECT * FROM engagement_alerts WHERE session_id = ? ORDER BY ts DESC LIMIT ?
        ''', (session_id, limit)).fetchall()
        return [dict(r) for r in rows]

def save_quiz(session_id: str, topic: str, payload: dict) -> dict:
    from datetime import datetime
    import uuid
    qid = str(uuid.uuid4())
    ts = datetime.utcnow().isoformat()
    with get_db() as db:
        db.execute('''
            INSERT INTO quizzes (id, session_id, topic, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (qid, session_id, topic, json.dumps(payload), ts))
        db.commit()
        return {'id': qid, 'payload': payload}

def get_quiz(quiz_id: str) -> dict:
    with get_db() as db:
        row = db.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
        if not row:
            raise ValueError(f"Quiz {quiz_id} not found")
        data = dict(row)
        if data['payload_json']:
            data.update(json.loads(data['payload_json']))
        return data

def list_quizzes(session_id: str) -> list:
    with get_db() as db:
        rows = db.execute("SELECT * FROM quizzes WHERE session_id = ? ORDER BY created_at DESC", (session_id,)).fetchall()
        result = []
        for r in rows:
            data = dict(r)
            if data['payload_json']:
                data.update(json.loads(data['payload_json']))
            result.append(data)
        return result

def save_quiz_response(quiz_id: str, session_id: str, student_id: str, answer_id: str, answer_text: str, is_correct: bool) -> dict:
    from datetime import datetime
    ts = datetime.utcnow().isoformat()
    with get_db() as db:
        cursor = db.cursor()
        cursor.execute('''
            INSERT INTO quiz_responses (quiz_id, session_id, student_id, ts, answer_id, answer_text, is_correct)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (quiz_id, session_id, student_id, ts, answer_id, answer_text, 1 if is_correct else 0))
        db.commit()
        return {'id': cursor.lastrowid}

def get_quiz_responses(quiz_id: str) -> list:
    with get_db() as db:
        rows = db.execute("SELECT * FROM quiz_responses WHERE quiz_id = ?", (quiz_id,)).fetchall()
        res = []
        for r in rows:
            d = dict(r)
            d['is_correct'] = bool(d['is_correct'])
            res.append(d)
        return res

def save_report(session_id: str, student_id: str, summary: str, recommendations: list) -> dict:
    from datetime import datetime
    import uuid
    rid = str(uuid.uuid4())
    ts = datetime.utcnow().isoformat()
    with get_db() as db:
        db.execute('''
            INSERT INTO reports (id, session_id, student_id, summary, recommendations_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (rid, session_id, student_id, summary, json.dumps(recommendations), ts))
        db.commit()
        return {'id': rid}

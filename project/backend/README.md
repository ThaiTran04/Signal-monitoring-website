# Backend — Industrial HMI Monitoring API

FastAPI + SQLite. Tự seed 200 máy mock (giống logic random gốc của frontend) khi khởi động lần đầu.

## Chạy

```bash
cd backend
pip install -r requirements.txt --break-system-packages   # hoặc dùng venv
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API docs (Swagger): http://localhost:8000/docs

## Đăng nhập demo
- username: `admin`
- password: `admin`

## Cấu trúc
```
app/
  main.py            # entrypoint, gắn router, CORS, startup seeding
  database/db.py      # engine/session SQLite
  models/models.py     # SQLAlchemy models (users, machines, machine_status,
                        #   io_history, oee_data, connection_history, hmi_login_history)
  schemas/schemas.py   # Pydantic request/response
  services/
    auth.py            # bcrypt hash + JWT token
    mock_data.py        # PRNG mock generator (giống hệt logic gốc trong App.tsx)
    seed.py             # seed toàn bộ DB lúc khởi động nếu rỗng
  api/
    auth.py, machines.py, status.py, io.py, oee.py,
    connection_history.py, hmi_login_history.py,
    device.py           # POST /api/device/update — endpoint cho ESP32/HMI
    ws.py                # WebSocket /ws — broadcast realtime
  websocket/manager.py
database/hmi.db      # file SQLite (tự tạo khi chạy)
```

## Endpoint chính
Xem đầy đủ tại `/docs`. Tóm tắt: /api/login, /api/me, /api/machines (CRUD),
/api/machines/{id}/status, /api/machines/status/summary,
/api/machines/{id}/io, /api/machines/{id}/io/history?date=YYYY-MM-DD,
/api/machines/{id}/oee, /api/oee/summary,
/api/connection-history, /api/hmi-login-history,
/api/device/update (POST, không cần token — dùng cho thiết bị),
/ws (WebSocket realtime).

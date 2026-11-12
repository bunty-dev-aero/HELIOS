import random,time,requests
from datetime import datetime,timezone
BASE="http://127.0.0.1:8000/api/v1"
CREW=["AST-001","AST-002","AST-003","AST-004"]
def send(aid,metric,value,unit):
    payload={"astronaut_id":aid,"metric":metric,"value":round(value,1),"unit":unit,
      "measured_at":datetime.now(timezone.utc).isoformat(),"source":"simulator",
      "simulated":True,"quality":"good","metadata":{"generator":"HELIOS demo simulator"}}
    r=requests.post(f"{BASE}/measurements",json=payload,timeout=10); r.raise_for_status()
    print(aid,metric,payload["value"],unit)
print("Simulated telemetry running. Ctrl+C to stop.")
while True:
    for aid in CREW:
        send(aid,"heart_rate",random.gauss(72,8),"bpm")
        send(aid,"spo2",random.gauss(97,1),"%")
        send(aid,"temperature",random.gauss(36.7,.25),"°C")
        send(aid,"sleep_hours",random.uniform(5,8.5),"hours")
    time.sleep(10)

import requests
BASE="http://127.0.0.1:8000/api/v1"
CREW=[("AST-001","Commander Vega","Commander"),("AST-002","Dr. Chen","Flight Engineer"),("AST-003","Maya Patel","Mission Specialist"),("AST-004","Alex Morgan","Medical Officer")]
for aid,name,role in CREW:
    r=requests.post(f"{BASE}/astronauts",json={"id":aid,"name":name,"mission_role":role,"mission_day":42,"is_simulated":True})
    if r.status_code==409: print(aid,"already exists")
    else: r.raise_for_status(); print("Created",aid)

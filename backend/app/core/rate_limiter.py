from slowapi import Limiter
from slowapi.util import get_remote_address

# Instance globale partagée entre main.py (enregistrement de l'exception handler)
# et les routes qui utilisent @limiter.limit().
# Séparé de main.py pour éviter l'import circulaire :
#   app.main → app.api.v1 → app.api.v1.auth → app.main (circulaire)
limiter = Limiter(key_func=get_remote_address)

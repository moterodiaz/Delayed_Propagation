from backend.models import NetworkView
COORDINATION_FACTOR = 0.75

def build_network_view(selfish_total_usd):
    coordinated = round(selfish_total_usd * COORDINATION_FACTOR, 2)
    return NetworkView(selfish_usd=round(selfish_total_usd,2), coordinated_usd=coordinated,
                       gap_usd=round(selfish_total_usd - coordinated, 2))

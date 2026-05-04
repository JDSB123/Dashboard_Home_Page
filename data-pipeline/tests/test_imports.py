def test_imports():
    import importlib

    for mod in [
        "pandas",
        "requests",
        "aiohttp",
        "dotenv",
        "azure.data.tables",
        "nba_api.stats.endpoints",
    ]:
        assert importlib.import_module(mod)

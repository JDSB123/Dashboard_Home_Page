def test_imports():
    import importlib

    for mod in [
        "pandas",
        "requests",
        "aiohttp",
        "dotenv",
    ]:
        assert importlib.import_module(mod)

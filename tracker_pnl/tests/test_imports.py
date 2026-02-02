def test_imports():
    import importlib

    for mod in [
        "pandas",
        "requests",
        "aiohttp",
        "dotenv",
        "msal",
        "office365.runtime.auth.authentication_context",
    ]:
        assert importlib.import_module(mod)

"""boty — wtyczka UI (pasek statusu + backend) dla Hermes Desktop.

Ta warstwa nie rejestruje narzędzi agenta; plugin działa wyłącznie w UI.
Shim jest wymagany, żeby loader Hermesa nie zgłaszał błędu importu
(patrz skill hermes-plugin-packaging).
"""


def register(ctx) -> None:  # noqa: ARG001
    return None

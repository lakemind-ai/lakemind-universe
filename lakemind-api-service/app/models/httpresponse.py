class HttpResponse:
    status: int
    message: str
    data: any
    has_more: bool
    total_count: int

    def __init__(self, message=None, status=None, data=None, has_more=False, total_count=None) -> None:
        self.message = message
        self.status = status
        self.data = data
        self.has_more = has_more
        self.total_count = total_count

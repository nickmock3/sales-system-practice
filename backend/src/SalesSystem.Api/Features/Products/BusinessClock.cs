namespace SalesSystem.Api.Features.Products;

public interface IBusinessClock
{
    DateTime Today { get; }
}

public sealed class BusinessClock(TimeProvider timeProvider) : IBusinessClock
{
    private static readonly TimeZoneInfo BusinessTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");

    public DateTime Today =>
        TimeZoneInfo.ConvertTimeFromUtc(timeProvider.GetUtcNow().UtcDateTime, BusinessTimeZone).Date;
}

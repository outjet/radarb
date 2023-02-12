function updateTime() {
    var localTime = new Date().toLocaleString("en-US", {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    var UTCtime = new Date(Date.now()).toLocaleString("en-US", {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'UTC'
    });
    document.getElementById("local-time").innerHTML = localTime;
    document.getElementById("utc-time").innerHTML = UTCtime;
}
setInterval(updateTime, 1000);
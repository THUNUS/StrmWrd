var concattxtforwordle = function(graphsrs) {
  var texts = [];
  for (var idx = 0; idx < graphsrs.length; idx++) {
    var oneseries = graphsrs[idx];
    var t = "", totalfreq = 0;
    for (var tidx = 0; tidx < oneseries.text.length; tidx++) {
      t += oneseries.text[tidx][1];
      totalfreq += oneseries['data'][tidx][1];
    }
    texts.push({"text": t, "color": oneseries.color, "weight": totalfreq});
  }
  return texts;
};

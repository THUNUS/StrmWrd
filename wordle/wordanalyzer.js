var WordAnalyzer = (function() {
  // get XmlHttpObject based on different browsers
  var getXmlHttpObject = function () {
    xmlHttp = null;
    try { // Firefox, Opera 8.0+, Safari
      xmlHttp = new XMLHttpRequest();
    } catch (e) { // Internet Explorer
      try {
        xmlHttp = new ActiveXObject("Msxml2.XMLHTTP");
      } catch (e) {
        try {
          xmlHttp = new ActiveXObject("Microsoft.XMLHTTP");
        } catch (e) {
          alert("Sorry, but your browser does not support AJAX.");
        }
      }
    }
    return xmlHttp;
  };

  // send ajax queries, in POST method, with the given url, parameters and the call back function
  // params is in array, e.g., ['a=1', 'b=2']
  var postAjaxQuery = function (url, params, callbackfunc) {
    var xmlHttp = getXmlHttpObject();
    if (xmlHttp == null) return;
    xmlHttp.onreadystatechange = function() {
      switch (xmlHttp.readyState) {
      case 1: // Loading
        break;
      case 2: // Loaded
        break;
      case 3: // Interactive
        break;
      case 4: // Ready
        if (xmlHttp.status == 200) { // complete
          callbackfunc(JSON.parse(xmlHttp.responseText));
        } else { // response error
        }
        break;
      }
    };
    xmlHttp.open('POST', url, true);
    xmlHttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xmlHttp.send(params.join('&'));
  };

  // module-like definition for methods, ref: http://javascriptweblog.wordpress.com/2010/12/07/namespacing-in-javascript/
  return {
    // segmenter using web service
    segment_remote: function (text, callbackfunc) {
      var t = text.toLowerCase();
      postAjaxQuery("wordle/seg.php", ["t=" + encodeURIComponent(t)], 
        function (result) {
          callbackfunc(result);
        });
    },

    // segmenter in local, simple strategy
    segment_local: function (text, callbackfunc) {
      var words = text.split(/\s/);
      callbackfunc(words);
    },

    // given a word array, return a hashtable of word frequencies
    // note: this step doesn't involve stopword removal
    wordfreq: function (words, mincount) {
      var worddict = {};
      for (var idx = 0; idx < words.length; idx++) {
        if (words[idx] in worddict) {
          worddict[words[idx]]++;
        } else {
          worddict[words[idx]] = 1;
        }
      }
      if (typeof mincount !== 'undefined') {
        // remove the words whose frequencies < mincount
        var newworddict = {};
        for (var word in worddict) {
          if (worddict[word] >= mincount)
            newworddict[word] = worddict[word];
        }
        worddict = newworddict;
      }
      return worddict;
    }
  };
})();

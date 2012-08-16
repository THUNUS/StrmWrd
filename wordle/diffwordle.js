// javascript defining classes, http://javascript.about.com/library/bltut35.htm
var DiffWordle = function(containerid, options) {
  // default options
  this.defaultoptions = {'width':350, 'height':200, 'scale':'log', 'type':0};
  // store the options
  if (typeof options !== 'undefined')
    this.wordleoptions = options;
  else
    this.wordleoptions = {};
  // check the options, if not assigned, give them default values
  for (var opt in this.defaultoptions) {
    if (!(opt in this.wordleoptions))
      this.wordleoptions[opt] = this.defaultoptions[opt];
  }

  this.wordlecontainerid = containerid; // the container div's id

  this.wordcolordict = {}; // store the color mapping to the words





  // draw the wordle, automatically determine the input text type: text string, array, etc.
  this.draw = function(textobj) {
    this.showLoading();

    var objtype = this.getType(textobj);
    if (objtype === '[object String]') {
      // string, we have to do word analysis: segmentation and compute the score
      var thewordle = this;
      this.analyzeText(textobj, function (worddict) { thewordle.drawCloud(thewordle.dictToList(worddict)); });
    } else if (objtype === '[object Object]') {
      // a hashtable, we only normalize it to a proper size
      this.drawCloud(this.dictToList(textobj));
    } else if (objtype === '[object Array]') {
      // a list, specifying different series. different colors can use this method
      // each element of the list must be an object, specified with a color
      this.goThroughSeries(textobj, 0, {});
    } else { // other types, not implemented
      return;
    }
  };

  // put a loading text in the container
  this.showLoading = function () {
    document.getElementById(this.wordlecontainerid).innerHTML = "<table width='" + this.wordleoptions['width'] + "' height='" + this.wordleoptions['height'] + "' border='0'><tr><td valign='middle' align='center'>Loading...</td></tr></table>";
  };



  this.mySort = function (a, b) {
    return b[1] - a[1]; // descending
  };

  // return the type (in string) of the object
  // examples: "[object String]", "[object Object]", "[object Array]", "[object Number]"
  this.getType = function (obj) {
    return Object.prototype.toString.apply(obj);
  };

  // normalize and then convert the dict to a list for drawing
  // note: the value of the dict can be either a number or an array
  // if a number: score. if an array: [{"score":"the score", "color":"its color"}, ...]
  this.dictToList = function (dict) {
    // normalize their sizes
    // first get the max value, at the same time check if its color is specified
    this.wordcolordict = {};
    var maxval = 0;
    for (var word in dict) {
      var value = dict[word];
      if (this.getType(value) === "[object Array]") {
        // compute the weighted average score and color
        // each element should be an object
        var rgbsum = [0, 0, 0], scoresum = 0;
        for (var idx = 0; idx < value.length; idx++) {
          var score = value[idx]['score'], color = value[idx]['color'];
          scoresum += score;
          var rgb = new RGBColor(color);
          if (rgb.ok) {
            rgbsum[0] += rgb.r * score;
            rgbsum[1] += rgb.g * score;
            rgbsum[2] += rgb.b * score;
          } else { // not recognized color, treated as black == add zero == do nothing
          }
        }
        if (scoresum > 0) {
          color = 'rgb(' + Math.floor(rgbsum[0] * 1.0 / scoresum).toString(10) + ','
                         + Math.floor(rgbsum[1] * 1.0 / scoresum).toString(10) + ','
                         + Math.floor(rgbsum[2] * 1.0 / scoresum).toString(10) + ')';
          this.wordcolordict[word] = color;
          value = scoresum * 1.0 / value.length;
        }
      } else { // value is a number, do nothing
      }
      if (value > maxval)
        maxval = value;
      dict[word] = value;
    }
    // then normalize, and convert to a list, finally sort it for drawing
    var list = [];
    for (var word in dict)
      list.push([word, dict[word] / maxval * 30]);
    list.sort(this.mySort);

    return list;
  };

  // look up the word in the color dictionary 
  this.getColor = function (word) {
    if (word in this.wordcolordict) {
      return this.wordcolordict[word];
    } else { // default: random_dark
      return 'rgb(' + Math.floor(Math.random()*128).toString(10) + ','
                    + Math.floor(Math.random()*128).toString(10) + ','
                    + Math.floor(Math.random()*128).toString(10) + ')';
    }
  };

  // do segmentation etc. need to specificy the succeeding function
  this.analyzeText = function (text, succfunction) {
    var thewordle = this;
    WordAnalyzer.segment_remote(text, function (words) {
      var wordfreqs = WordAnalyzer.wordfreq(words, 2);
      var worddict = {}; // the hashtable
      // compute a proper score (log, etc.)
      for (var key in wordfreqs) {
        if (key.length <= 1)
          continue;
        if (Stopwords.contains(key))
          continue;
        // apply the scaling option to the word weight
        var scaletype = thewordle.getType(thewordle.wordleoptions['scale']);
        // assign the default value first
        worddict[key] = wordfreqs[key];
        if (scaletype === '[object String]') { // preset methods, 'log' or 'sqrt'
          if (thewordle.wordleoptions['scale'] == 'log')
            worddict[key] = Math.ceil(Math.log(wordfreqs[key] + 1));
          else if (thewordle.wordleoptions['scale'] == 'sqrt')
            worddict[key] = Math.ceil(Math.sqrt(wordfreqs[key]));
        } else if (scaletype === '[object Function]') { // function
            worddict[key] = thewordle.wordleoptions['scale'](wordfreqs[key]);
        }
      }
      succfunction(worddict);
    });
  };

  // store the given worddict into the fulldict
  this.storeDict = function (fulldict, worddict, seriescolor, seriesweight) {
    for (var word in worddict) {
      var value = [];
      if (word in fulldict) {
        // if the fulldict contains this word -- it appears in multiple series
        value = fulldict[word];
        value.push({"score": worddict[word] * seriesweight, "color": seriescolor}); // common words
      } else {
        // store with the series' color
        value = [{"score": worddict[word] * seriesweight, "color": seriescolor}];
      }
      fulldict[word] = value;
    }
    return fulldict;
  };

  // go through each series, check if the data is a text or a hashtable
  // store the series into the fulldict (full dictionary containing all words)
  this.goThroughSeries = function (arr, idx, fulldict) {
    var seriescolor = arr[idx]['color'];
    var seriesweight = 1;
    if (typeof arr[idx]['weight'] !== 'undefined')
      seriesweight = arr[idx]['weight'];
    var textobj = arr[idx]['text'];
    if (this.getType(textobj) === '[object String]') {
      var thewordle = this;
      this.analyzeText(textobj, function (worddict) { 
        // store the current series
        fulldict = thewordle.storeDict(fulldict, worddict, seriescolor, seriesweight);
        if (idx + 1 < arr.length) {
          // continue to the next series
          thewordle.goThroughSeries(arr, idx + 1, fulldict);
        } else {
          // finished processing all series
          thewordle.drawCloud(thewordle.dictToList(fulldict));
        }
      });
      return;
    } else if (this.getType(textobj) === '[object Object]') {
      // store the current series
      fulldict = this.storeDict(fulldict, worddict, seriescolor);
    } else { // not implemented, skip it
    }
    if (idx + 1 < arr.length) {
      // continue to the next series
      this.goThroughSeries(arr, idx + 1, fulldict);
    } else {
      // finished processing all series
      this.drawCloud(this.dictToList(fulldict));
    }
  };

  // given the word list, draw the cloud
  // note we have two types of libs for drawing
  this.drawCloud = function (list) {
    // create svg or canvas depending on the "type" option
    if (this.wordleoptions['type'] == 0) { // svg using d3-cloud
      var container = document.getElementById(this.wordlecontainerid);
      container.innerHTML = '<svg width="' + this.wordleoptions['width'] + '" height="' + this.wordleoptions['height'] + '"></svg>';
      var containersvg = container.firstChild;
      while (containersvg.lastChild) {
        containersvg.removeChild(containersvg.lastChild);
      }
      var thewordle = this;
      d3.layout.cloud().size([this.wordleoptions['width'], this.wordleoptions['height']])
        .timeInterval(10)
        .words(list.map(function(d) {
          return {text: d[0], size: d[1]};
        }))
        .rotate(function() { return 0; })
        .font("Arial,Sans-serif")
        .fontSize(function(d) { return d.size; })
        .on("end", function(words) {
          d3.select(containersvg)
            .append("g")
              .attr("transform", "translate(175,100)")
            .selectAll("text")
              .data(words)
            .enter().append("text")
              .style("font-size", function(d) { return d.size + "px"; })
              .style("font-family", function(d) { return d.font; })
              .style("fill", function(d) {
                return thewordle.getColor(d.text);
              })
              .attr("text-anchor", "middle")
              .attr("transform", function(d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
              })
              .on("click", function(d) {
                // alert(JSON.stringify(d));
              })
            .text(function(d) { return d.text; });
          })
        .start();
    } else { // canvas using html5-wordcloud
      jQuery(function ($) {
        var containerid = this.wordlecontainerid + "_wordle" + new Date().getTime();
        document.getElementById(this.wordlecontainerid).innerHTML = '<canvas id="' + containerid + '" width="' + this.wordleoptions['width'] + '" height="' + this.wordleoptions['height'] + '"></canvas>';
        var $r = $('#' + containerid);
        $r.wordCloud({
          wordList: list,
          wait: 0,
          fillBox: false,
          clearCanvas: true,
          drawMask: false,
          wordColor: function(word, weight, fontSize, radius, theta) {
            return this.getColor(word);
          }
        });
      });
    }
  };

};

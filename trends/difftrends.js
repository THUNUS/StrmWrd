var DiffTrends = (function() {
  // the data table
  var datatable = null, xindex = -1, yindex = -1, tindex = -1, 
    xtype = null, // xtype: string, number-<granularity>
    ytype = 'linear'; // ytype: linear, logarithmic
  var options = null;
  // color dictionary
  var presetcolors = ['#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE', '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'];
  var graycolor = '#888888';
  var facetvaluecolors = []; // a list containing the color-dict of each facet
  var drawcallbackfcn = null; // a call back function after each draw();

  // chart container for drawing
  var chartcontainer = null;

  // my functions
  var $I = function(id) {
    return document.getElementById(id);
  };

  /**
    reset the timestamp according to the level, e.g., under the month level, a timestamp of date 'Jul 4th 2012 7pm' is reset to 'Jul 1st 2012 12:00:00am'
  **/
  var resetTimestamp = function (ts, level) {
    var d = new Date(ts);
    switch (level) {
    case 'year':
      d.setMonth(0);
    case 'month':
      d.setDate(1);
    case 'day':
      d.setHours(0);
    case 'hour':
      d.setMinutes(0);
    case 'minute':
      d.setSeconds(0);
    };
    return d.getTime();
  };

  /**
    get the timestamp of the previous or next unit
    prevOrNext is -1 (previous) or 1 (next unit)
    note: lower (than level) parts in the returned timestamp are reset to 0
  **/
  var adjacentTimestamp = function (ts, level, prevOrNext) {
    var d = new Date(resetTimestamp(ts, level));
    switch (level) {
    case 'second':
      d.setSeconds(d.getSeconds() + prevOrNext);
      break;
    case 'minute':
      d.setMinutes(d.getMinutes() + prevOrNext);
      break;
    case 'hour':
      d.setHours(d.getHours() + prevOrNext);
      break;
    case 'day':
      d.setDate(d.getDate() + prevOrNext);
      break;
    case 'month':
      d.setMonth(d.getMonth() + prevOrNext);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() + prevOrNext);
      break;
    };
    return d.getTime();
  };

  /**
    format a date to a string, depending on different levels (year, month, etc.)
      d is in Date type
      timeinterval is in milliseconds, e.g. 1000 for seconds and 3600000 for hours
    examples see below.
  **/
  var formatDate = function (d, granularity) {
    switch (granularity) {
    case 'year': // 2012
      return "" + d.getFullYear();
    case 'month': // Jul 2012
      return label2str(d.getMonth() + 1, 'month') + " " + d.getFullYear();
    }
    // now it at least contains the full date string
    var s = label2str(d.getMonth() + 1, 'month') + " " + label2str(d.getDate(), 'day') + " " + d.getFullYear();
    if (granularity == 'day') // day level: Jul 4th 2012
      return s;
    var hourstr = label2str(d.getHours(), 'hour');
    // now we have to split "am/pm" from the full "7pm"
    var hourIn12 = hourstr.substring(0, hourstr.length - 2);
    var amOrPm = hourstr.substring(hourstr.length - 2);
    switch (granularity) {
    case 'hour': // hour level: Jul 4th 2012 7pm
      return s + " " + hourstr;
    case 'minute': // minute level: Jul 4th 2012 7:03pm
      return s + " " + hourIn12 + ":" + padding(d.getMinutes(), 2, "0") + amOrPm;
    default: // second level: Jul 4th 2012 7:03:09pm
      return s + " " + hourIn12 + ":" + padding(d.getMinutes(), 2, "0") + ":" + padding(d.getSeconds(), 2, "0") + amOrPm;
    }
  };

  /**
    translate a value in a certain level to a readable string
    e.g. "3" in month level => "Mar", "16" in hour level => "4pm"
  **/
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var label2str = function (label, level) {
    label = "" + label;
    switch (level) {
    case 'total':
      return 'Total';
    case 'year':
      return label;
    case 'month':
      return MONTHS[parseInt(label) - 1];
    case 'day':
      if (label.charAt(label.length - 1) == '1' && label != '11')
        return label + 'st';
      else if (label.charAt(label.length - 1) == '2' && label != '12')
        return label + 'nd';
      else if (label.charAt(label.length - 1) == '3' && label != '13')
        return label + 'rd';
      return label + 'th';
    case 'hour':
      var h = parseInt(label);
      return ((h + 11) % 12 + 1) + ((h >= 12) ? "pm" : "am");
    default:
      return label;
    }
  };

  /**
    padding something in front of another string if the length is shorter
    if "str" is shorter than "len", put several "padding"'s at the beginning
  **/
  var padding = function (str, len, padding) {
    var s = "" + str;
    while (s.length < len)
      s = padding + s;
    return s;
  };

  // module-like definition for methods, ref: http://javascriptweblog.wordpress.com/2010/12/07/namespacing-in-javascript/
  return {
    // initialize the data table and the control box
    init: function(data, controldiv, chartdiv, drawcallbackfunction) {
      // the data table and index's
      datatable = data;
      options = datatable.options;
      xindex = datatable.heads.indexOf(datatable.x);
      yindex = datatable.heads.indexOf(datatable.y);
      tindex = datatable.heads.indexOf(datatable.text);
      xtype = typeof(datatable.data[0][xindex]);
      if (xtype.indexOf('number') == 0) { // check the x column is in seconds or in milliseconds
        var s = datatable.data[0][xindex] + '';
        if (s.length <= 10) { // convert to milliseconds
          for (var idx = 0; idx < datatable.data.length; idx++)
            datatable.data[idx][xindex] *= 1000;
        }
      }
      if (options && options.logY)
        ytype = 'logarithmic';
      else
        ytype = 'linear';

      // the control box, "select" for facets, facet values and "button" for drawing
      var html = "Facet: ";
      html += "<select id='mytrendfacetname' onchange ='DiffTrends.updateFacetValues();DiffTrends.draw();'" + (options.selectClass ? "class='" + options.selectClass + "'" : "") + ">";
      facetvaluecolors = [];
      for (var idx = 0; idx < datatable.facets.length; idx++) {
        html += "<option value='" + datatable.facets[idx] + "'>" + datatable.facets[idx] + "</option>";
        // also initialize the color list
        facetvaluecolors.push({});
      }
      html += "</select> ";
      // "select" for facet values, default is "all"
      html += "Value: <select id='mytrendfacetvalue' onchange='DiffTrends.draw();'" + (options.selectClass ? "class='" + options.selectClass + "'" : "") + "></select>";
      // the draw button. removed for now
        // html += "<input type='button' value='Draw' onclick='DiffTrends.draw();' />";
      // draw the controls to the div
      $I(controldiv).innerHTML = html;

      // now traverse the datatable to push every facet value in
      var facetvaluesizes = []; // current size of the values of each facet
      for (var idx = 0; idx < datatable.data.length; idx++) {
        var record = datatable.data[idx];
        for (var fidx = 0; fidx < datatable.facets.length; fidx++) {
          if (facetvaluesizes.length <= fidx)
            facetvaluesizes.push(0);
          var fvalue = record[datatable.heads.indexOf(datatable.facets[fidx])];
          if (!("" + fvalue in facetvaluecolors[fidx])) {
            if (options.facetColors && datatable.facets[fidx] in options.facetColors) {
              var colordict = options.facetColors[datatable.facets[fidx]];
              facetvaluecolors[fidx]["" + fvalue] = colordict["" + fvalue];
            } else {
              facetvaluecolors[fidx]["" + fvalue] = presetcolors[facetvaluesizes[fidx] % presetcolors.length];
            }
            facetvaluesizes[fidx]++;
          }
        }
      }
      DiffTrends.updateFacetValues();

      // the chart div
      chartcontainer = chartdiv;

      // the call back function after draw()
      drawcallbackfcn = drawcallbackfunction;

      DiffTrends.draw();
    },

    // generate the facets values and update that "select"
    updateFacetValues: function() {
      var fidx = $I('mytrendfacetname').options.selectedIndex;
      if (typeof fidx === 'undefined')
        fidx = 0;
      var facetvalueselect = $I('mytrendfacetvalue');
      // clear the previous options in the select
      while (facetvalueselect.options.length) {
        facetvalueselect.remove(0);
      }
      // add "All" as the 1st option, then add each individual
      facetvalueselect.options.add(new Option('(All)', 0));
      // pick the facet values from the facetvaluecolors
      for (var fvalue in facetvaluecolors[fidx]) {
        var opt = new Option(fvalue, fvalue);
        facetvalueselect.options.add(opt);
      }
    },

    // draw the chart
    draw: function() {
      // prepare the data: x, y (from subtotal)

      // the facet is chosen from the "select"
      var fnameoptidx = $I('mytrendfacetname').options.selectedIndex; // the option index indicating which facet
      var fcolidx = datatable.heads.indexOf(datatable.facets[fnameoptidx]); // the facet column index in the table
      var fvaloptidx = $I('mytrendfacetvalue').options.selectedIndex; // the option index indicating which value of the facet

      // compute the subtotal, scan through the whole table
      var dataobj = {}, textobj = {}; // x as the 1st key, facet as the 2nd key
      var xs = [], facets = []; // store the different x's and facets
      for (var idx = 0; idx < datatable.data.length; idx++) {
        var record = datatable.data[idx];
        var xvalue = '' + record[xindex],
          yvalue = record[yindex],
          fvalue = '' + record[fcolidx],
          tvalue = record[tindex];
        // check if one vs. all
        if (fvaloptidx != 0) { // selected some specific facet value
          if (fvalue !== $I('mytrendfacetvalue').value) {
            // put in the "others"
            fvalue = 'Others';
          }
        }
        // store x's and facets
        if (xs.indexOf(xvalue) < 0)
          xs.push(xvalue);
        if (facets.indexOf(fvalue) < 0)
          facets.push(fvalue);
        // check the 1st key: x
        if (dataobj[xvalue] === undefined) {
          dataobj[xvalue] = {};
          textobj[xvalue] = {};
        }
        // check the 2nd key: facet
        if (dataobj[xvalue][fvalue] === undefined) {
          dataobj[xvalue][fvalue] = 0;
          textobj[xvalue][fvalue] = "";
        }
        dataobj[xvalue][fvalue] += yvalue;
        textobj[xvalue][fvalue] += tvalue + " ";
      }

      xs.sort();
      facets.sort();
      // the "Others" is always the first -- on top of the stacks
      // note: if there's only one facet, one vs. all view won't have 'Others'.
      if (fvaloptidx != 0) {
        if (facets.indexOf('Others') >= 0) {
          facets.splice(facets.indexOf("Others"), 1);
          facets.splice(0, 0, 'Others');
        }
      }

      // now generate the series: a list of facets
      var srs = [], plusonesrs = []; // plusonesrs has a value of +1 than the original
      // if x-axis is a numbered (datetime, timestamp) type, draw according the time
      if (xtype.indexOf('number') == 0) {
        /*
        // if over 5 days long, use day-level, otherwise hour-level
        var timeinterval = 3600 * 1000; // default hour-level
        var starttime = Number(xs[0]), endtime = Number(xs[xs.length - 1]);
        if ((endtime - starttime) / 1000 / 3600 / 24 > 5) { // day-level
          timeinterval *= 24;
        }
        if (datatable.granularity && datatable.granularity.length > 0) { // the timeinterval is set
          timeinterval = datatable.granularity * 1000;
        }
        xtype += '-' + timeinterval;
alert([starttime, endtime]);
        starttime = Math.floor(starttime / timeinterval) * timeinterval;
        endtime = Math.floor(endtime / timeinterval) * timeinterval;
alert([starttime, endtime]);
        */
        // update: we use a new strategy to normalize the newxs
        // the starttime and endtime now are only used for determining if adding zeros the datapoint
        var starttime = resetTimestamp(Number(xs[0])), endtime = resetTimestamp(Number(xs[xs.length - 1]));
        xtype += '-' + datatable.granularity;

        // generate the new x points
        var newxs = [];
        for (var xidx = 0; xidx < xs.length; xidx++) {
          var xvalue = Number(xs[xidx]);
          // var newxvalue = Math.floor((xvalue - starttime) / timeinterval) * timeinterval + starttime;
          var newxvalue = resetTimestamp(xvalue, datatable.granularity);

          // we add zero points beside a numbered point. 
          // if starttime == endtime, we add two zeros beside this only time point.
          // otherwise, we add zeros except the point before start and the point after end.
          /*if ((starttime == endtime || newxvalue - timeinterval >= starttime) && newxs.indexOf(newxvalue - timeinterval) < 0) // before current
            newxs.push(newxvalue - timeinterval);
          if (newxs.indexOf(newxvalue) < 0) // current
            newxs.push(newxvalue);
          if ((starttime == endtime || newxvalue + timeinterval <= endtime) && newxs.indexOf(newxvalue + timeinterval) < 0) // after current
            newxs.push(newxvalue + timeinterval);*/
          var prevxvalue = adjacentTimestamp(newxvalue, datatable.granularity, -1), nextxvalue = adjacentTimestamp(newxvalue, datatable.granularity, 1);
          if ((starttime == endtime || prevxvalue >= starttime) && newxs.indexOf(prevxvalue) < 0) // before current
            newxs.push(prevxvalue);
          if (newxs.indexOf(newxvalue) < 0) // current
            newxs.push(newxvalue);
          if ((starttime == endtime || nextxvalue <= endtime) && newxs.indexOf(nextxvalue) < 0) // after current
            newxs.push(nextxvalue);
        }
        newxs.sort();

        /*// highcharts draw the datetime-ed x values in UTC timezone, not local (UTC+8)
        // we have to change it to our fixed timezone
        var tzoffset = 8 * 3600 * 1000;*/
        // update: highcharts has a global setting "useUTC" whose default is true... we change it to false then everything is solved.
        var tzoffset = 0;

        for (var fidx = 0; fidx < facets.length; fidx++) {
          var recorddata = new Array(newxs.length), recordtext = new Array(newxs.length);
          for (var newxidx = 0; newxidx < newxs.length; newxidx++) {
            recorddata[newxidx] = [newxs[newxidx] + tzoffset, 0];
            recordtext[newxidx] = [newxs[newxidx] + tzoffset, ""];
          }
          // accumulate the old x into the new x
          for (var xidx = 0; xidx < xs.length; xidx++) {
            var xvalue = Number(xs[xidx]);
            var newxvalue = resetTimestamp(xvalue, datatable.granularity);
            var newxidx = newxs.indexOf(newxvalue);
            if (dataobj['' + xs[xidx]] !== undefined && dataobj['' + xs[xidx]]['' + facets[fidx]] !== undefined) {
              recorddata[newxidx][1] += dataobj['' + xs[xidx]]['' + facets[fidx]];
              recordtext[newxidx][1] += textobj['' + xs[xidx]]['' + facets[fidx]] + " ";
            }
          }
          var thiscolor = graycolor;
          if (('' + facets[fidx]) in facetvaluecolors[fnameoptidx])
            thiscolor = facetvaluecolors[fnameoptidx]['' + facets[fidx]];
          srs.push({name: '' + facets[fidx], data: recorddata, color: thiscolor, text: recordtext});
          var plusonerecorddata = recorddata;
          for (var recidx = 0; recidx < recorddata.length; recidx++) 
            plusonerecorddata[recidx][1] += 1;
          plusonesrs.push({name: '' + facets[fidx], data: plusonerecorddata, color: thiscolor, text: recordtext});
        }
        xs = newxs;
      } else { // discrete labels
        for (var fidx = 0; fidx < facets.length; fidx++) {
          var recorddata = [];
          for (var xidx = 0; xidx < xs.length; xidx++) {
            var v = 0, t = "";
            if (dataobj['' + xs[xidx]] !== undefined && dataobj['' + xs[xidx]]['' + facets[fidx]] !== undefined) {
              v = dataobj['' + xs[xidx]]['' + facets[fidx]];
              t = textobj['' + xs[xidx]]['' + facets[fidx]];
            }
            recorddata.push(v);
            recordtext.push(t);
          }
          var thiscolor = graycolor;
          if (('' + facets[fidx]) in facetvaluecolors[fnameoptidx])
            thiscolor = facetvaluecolors[fnameoptidx]['' + facets[fidx]];
          srs.push({name: '' + facets[fidx], data: recorddata, color: thiscolor, text: recordtext});
        }
      }

      // a Highcharts object for drawing
      Highcharts.setOptions({
        global: {
          useUTC: false
        }
      });
      var chart = new Highcharts.Chart({
        chart: {
          renderTo: chartcontainer,
          type: 'areaspline'
        },
        title: {
          text: null
        },
        legend: {
          enabled: false,
          layout: 'vertical',
          align: 'right',
          verticalAlign: 'bottom',
          floating: false,
          borderWidth: 1,
          backgroundColor: '#FFFFFF'
        },
        tooltip: {
          useHTML: true,
          formatter: function() {
            var X = this.x;
            if (xtype.indexOf('number') == 0) {
              var d = new Date(this.x);
              /*// this time is converted to our timezone. its "UTC" time is the actual time
              X = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();*/
              // update: use highcharts' setting of utc instead
              var granularity = datatable.granularity;
              X = formatDate(d, granularity);
            }
            var Y = this.y;
            if (ytype == 'logarithmic')
              Y -= 1;
            return this.series.name + ': ' + Y + '<br/>' + X;
          }
        },
        credits: {
          enabled: false
        },
        exporting: {
          enabled: false
        },
        plotOptions: {
          areaspline: {
            fillOpacity: 1,
            cursor: 'pointer',
            animation: false,
            trackByArea: true,
            stacking: 'normal',
            events: {
              click: function (event) {
                var seriesname = this.name;
                if (seriesname == 'Others')
                  seriesname = 0;
                $I('mytrendfacetvalue').value = seriesname;
                DiffTrends.draw();
              }
            }
          },
          series: {
            marker: {
              enabled: false/*,
              states: {
                hover: {
                  enabled: true
                }
              }*/
            }
          }
        },
        xAxis: {
          type: ((xtype.indexOf('number') == 0) ? 'datetime' : 'linear'),
          tickmarkPlacement: 'on'
        },
        yAxis: {
          title: {
            // text: datatable.y
            text: null
          },
          endOnTick: false,
          type: ytype,
          min: (ytype == 'logarithmic' ? 1 : 0),
          labels: {
            enabled: (ytype == 'logarithmic')
          }
        },
        series: (ytype == 'logarithmic' ? plusonesrs : srs)
      });
      if (typeof drawcallbackfcn !== "undefined")
        drawcallbackfcn(srs);
    }
  };
})();

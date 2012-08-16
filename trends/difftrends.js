// javascript defining classes, http://javascript.about.com/library/bltut35.htm
var DiffTrends = function(data, controldiv, chartdiv, varname, drawcallbackfunction) {
  // the data table
  this.datatable = data;
  // necessary marks
  this.xindex = this.datatable.heads.indexOf(this.datatable.x);
  this.yindex = this.datatable.heads.indexOf(this.datatable.y);
  this.tindex = this.datatable.heads.indexOf(this.datatable.text);
  // xtype: string, number-<granularity>
  this.xtype = typeof(this.datatable.data[0][this.xindex]);
  if (this.xtype.indexOf('number') == 0) { // check the x column is in seconds or in milliseconds
    var s = this.datatable.data[0][this.xindex] + '';
    if (s.length <= 10) { // convert to milliseconds
      for (var idx = 0; idx < this.datatable.data.length; idx++)
        this.datatable.data[idx][this.xindex] *= 1000;
    }
  }
  // ytype: linear, logarithmic
  if (this.options && this.options.logY)
    this.ytype = 'logarithmic';
  else
    this.ytype = 'linear';


  // drawing options
  this.options = this.datatable.options;

  // color dictionary
  this.presetcolors = ['#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE', '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'];
  this.graycolor = '#888888';
  this.facetvaluecolors = []; // a list containing the color-dict of each facet

  // the call back function after draw()
  this.drawcallbackfcn = drawcallbackfunction;

  // containers for drawing
  this.controlcontainer = controldiv;
  this.chartcontainer = chartdiv;


  // a function short for getElementById
  this.$I = function(id) {
    return document.getElementById(id);
  };

  // now draw the control box, "select" for facets, facet values and "button" for drawing
  var html = "Facet: ";
  html += "<select id='" + controldiv + "_mytrendfacetname' onchange='" + varname + ".updateFacetValuesAndDraw();' " + (this.options.selectClass ? "class='" + this.options.selectClass + "'" : "") + ">";
  this.facetvaluecolors = [];
  for (var idx = 0; idx < this.datatable.facets.length; idx++) {
    html += "<option value='" + this.datatable.facets[idx] + "'>" + this.datatable.facets[idx] + "</option>";
    // also initialize the color list
    this.facetvaluecolors.push({});
  }
  html += "</select> ";
  // "select" for facet values, default is "all"
  html += "Value: <select id='" + controldiv + "_mytrendfacetvalue' onchange='" + varname + ".draw();' " + (this.options.selectClass ? "class='" + this.options.selectClass + "'" : "") + "></select>";
  // render the controls to the div
  this.$I(controldiv).innerHTML = html;



  // now traverse the this.datatable to push every facet value in
  var facetvaluesizes = []; // current size of the values of each facet
  for (var idx = 0; idx < this.datatable.data.length; idx++) {
    var record = this.datatable.data[idx];
    for (var fidx = 0; fidx < this.datatable.facets.length; fidx++) {
      if (facetvaluesizes.length <= fidx)
        facetvaluesizes.push(0);
      var fvalue = record[this.datatable.heads.indexOf(this.datatable.facets[fidx])];
      if (!("" + fvalue in this.facetvaluecolors[fidx])) {
        if (this.options.facetColors && this.datatable.facets[fidx] in this.options.facetColors) {
          var colordict = this.options.facetColors[this.datatable.facets[fidx]];
          this.facetvaluecolors[fidx]["" + fvalue] = colordict["" + fvalue];
        } else {
          this.facetvaluecolors[fidx]["" + fvalue] = this.presetcolors[facetvaluesizes[fidx] % this.presetcolors.length];
        }
        facetvaluesizes[fidx]++;
      }
    }
  }





  /**
    reset the timestamp according to the level, e.g., under the month level, a timestamp of date 'Jul 4th 2012 7pm' is reset to 'Jul 1st 2012 12:00:00am'
  **/
  this.resetTimestamp = function (ts, level) {
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
  this.adjacentTimestamp = function (ts, level, prevOrNext) {
    var d = new Date(this.resetTimestamp(ts, level));
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
  this.formatDate = function (d, granularity) {
    switch (granularity) {
    case 'year': // 2012
      return "" + d.getFullYear();
    case 'month': // Jul 2012
      return this.label2str(d.getMonth() + 1, 'month') + " " + d.getFullYear();
    }
    // now it at least contains the full date string
    var s = this.label2str(d.getMonth() + 1, 'month') + " " + this.label2str(d.getDate(), 'day') + " " + d.getFullYear();
    if (granularity == 'day') // day level: Jul 4th 2012
      return s;
    var hourstr = this.label2str(d.getHours(), 'hour');
    // now we have to split "am/pm" from the full "7pm"
    var hourIn12 = hourstr.substring(0, hourstr.length - 2);
    var amOrPm = hourstr.substring(hourstr.length - 2);
    switch (granularity) {
    case 'hour': // hour level: Jul 4th 2012 7pm
      return s + " " + hourstr;
    case 'minute': // minute level: Jul 4th 2012 7:03pm
      return s + " " + hourIn12 + ":" + this.padding(d.getMinutes(), 2, "0") + amOrPm;
    default: // second level: Jul 4th 2012 7:03:09pm
      return s + " " + hourIn12 + ":" + this.padding(d.getMinutes(), 2, "0") + ":" + this.padding(d.getSeconds(), 2, "0") + amOrPm;
    }
  };

  /**
    translate a value in a certain level to a readable string
    e.g. "3" in month level => "Mar", "16" in hour level => "4pm"
  **/
  this.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  this.label2str = function (label, level) {
    label = "" + label;
    switch (level) {
    case 'total':
      return 'Total';
    case 'year':
      return label;
    case 'month':
      return this.MONTHS[parseInt(label) - 1];
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
    if "str" is shorter than "len", put several paddingchars at the beginning
  **/
  this.padding = function (str, len, paddingchar) {
    var s = "" + str;
    while (s.length < len)
      s = paddingchar + s;
    return s;
  };







  // generate the facets values and update that "select", and draw the chart again
  this.updateFacetValuesAndDraw = function() {
    var fidx = this.$I(this.controlcontainer + '_mytrendfacetname').options.selectedIndex;
    if (typeof fidx === 'undefined')
      fidx = 0;
    var facetvalueselect = this.$I(this.controlcontainer + '_mytrendfacetvalue');
    // clear the previous this.options in the select
    while (facetvalueselect.options.length) {
      facetvalueselect.remove(0);
    }
    // add "All" as the 1st option, then add each individual
    facetvalueselect.options.add(new Option('(All)', 0));
    // pick the facet values from the this.facetvaluecolors
    for (var fvalue in this.facetvaluecolors[fidx]) {
      var opt = new Option(fvalue, fvalue);
      facetvalueselect.options.add(opt);
    }
    this.draw();
  };





  // draw the chart
  this.draw = function() {
    // prepare the data: x, y (from subtotal)

    // the facet is chosen from the "select"
    var fnameoptidx = this.$I(this.controlcontainer + '_mytrendfacetname').options.selectedIndex; // the option index indicating which facet
    var fcolidx = this.datatable.heads.indexOf(this.datatable.facets[fnameoptidx]); // the facet column index in the table
    var fvaloptidx = this.$I(this.controlcontainer + '_mytrendfacetvalue').options.selectedIndex; // the option index indicating which value of the facet

    // compute the subtotal, scan through the whole table
    var dataobj = {}, textobj = {}; // x as the 1st key, facet as the 2nd key
    var xs = [], facets = []; // store the different x's and facets
    for (var idx = 0; idx < this.datatable.data.length; idx++) {
      var record = this.datatable.data[idx];
      var xvalue = '' + record[this.xindex],
        yvalue = record[this.yindex],
        fvalue = '' + record[fcolidx],
        tvalue = record[this.tindex];
      // check if one vs. all
      if (fvaloptidx != 0) { // selected some specific facet value
        if (fvalue !== this.$I(this.controlcontainer + '_mytrendfacetvalue').value) {
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
    if (this.xtype.indexOf('number') == 0) {
      // update: we use a new strategy to normalize the newxs
      // the starttime and endtime now are only used for determining if adding zeros the datapoint
      var starttime = this.resetTimestamp(Number(xs[0])), endtime = this.resetTimestamp(Number(xs[xs.length - 1]));
      this.xtype += '-' + this.datatable.granularity;

      // generate the new x points
      var newxs = [];
      for (var xidx = 0; xidx < xs.length; xidx++) {
        var xvalue = Number(xs[xidx]);
        // var newxvalue = Math.floor((xvalue - starttime) / timeinterval) * timeinterval + starttime;
        var newxvalue = this.resetTimestamp(xvalue, this.datatable.granularity);

        // we add zero points beside a numbered point. 
        // if starttime == endtime, we add two zeros beside this only time point.
        // otherwise, we add zeros except the point before start and the point after end.
        var prevxvalue = this.adjacentTimestamp(newxvalue, this.datatable.granularity, -1), nextxvalue = this.adjacentTimestamp(newxvalue, this.datatable.granularity, 1);
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
          var newxvalue = this.resetTimestamp(xvalue, this.datatable.granularity);
          var newxidx = newxs.indexOf(newxvalue);
          if (dataobj['' + xs[xidx]] !== undefined && dataobj['' + xs[xidx]]['' + facets[fidx]] !== undefined) {
            recorddata[newxidx][1] += dataobj['' + xs[xidx]]['' + facets[fidx]];
            recordtext[newxidx][1] += textobj['' + xs[xidx]]['' + facets[fidx]] + " ";
          }
        }
        var thiscolor = this.graycolor;
        if (('' + facets[fidx]) in this.facetvaluecolors[fnameoptidx])
          thiscolor = this.facetvaluecolors[fnameoptidx]['' + facets[fidx]];
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
        var thiscolor = this.graycolor;
        if (('' + facets[fidx]) in this.facetvaluecolors[fnameoptidx])
          thiscolor = this.facetvaluecolors[fnameoptidx]['' + facets[fidx]];
        srs.push({name: '' + facets[fidx], data: recorddata, color: thiscolor, text: recordtext});
      }
    }

    // a Highcharts object for drawing
    var thetrends = this;
    Highcharts.setOptions({
      global: {
        useUTC: false
      }
    });
    var chart = new Highcharts.Chart({
      chart: {
        renderTo: this.chartcontainer,
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
          if (thetrends.xtype.indexOf('number') == 0) {
            var d = new Date(this.x);
            /*// this time is converted to our timezone. its "UTC" time is the actual time
            X = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();*/
            // update: use highcharts' setting of utc instead
            var granularity = thetrends.datatable.granularity;
            X = thetrends.formatDate(d, granularity);
          }
          var Y = this.y;
          if (thetrends.ytype == 'logarithmic')
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
              thetrends.$I(thetrends.controlcontainer + '_mytrendfacetvalue').value = seriesname;
              thetrends.draw();
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
        type: ((this.xtype.indexOf('number') == 0) ? 'datetime' : 'linear'),
        tickmarkPlacement: 'on'
      },
      yAxis: {
        title: {
          // text: this.datatable.y
          text: null
        },
        endOnTick: false,
        type: this.ytype,
        min: (this.ytype == 'logarithmic' ? 1 : 0),
        labels: {
          enabled: (this.ytype == 'logarithmic')
        }
      },
      series: (this.ytype == 'logarithmic' ? plusonesrs : srs)
    });
    if (typeof this.drawcallbackfcn !== "undefined")
      this.drawcallbackfcn(srs);
  };


  // after we define this function, we draw for the first time
  this.updateFacetValuesAndDraw();

};

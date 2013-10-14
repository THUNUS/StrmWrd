<?php
// php send POST request. ref: http://www.jonasjohn.de/snippets/php/post-request.htm
function post_request ($url, $data, $referer='') {
  // Convert the data array into URL Parameters like a=b&foo=bar etc.
  $data = http_build_query($data);

  // parse the given URL
  $url = parse_url($url);

  if ($url['scheme'] != 'http') {
    die('Error: Only HTTP request are supported !');
  }

  // extract host and path:
  $host = $url['host'];
  $path = $url['path'];

  // open a socket connection on port 80 - timeout: 30 sec
  $fp = fsockopen($host, 80, $errno, $errstr, 30);

  if ($fp) {
    // send the request headers:
    fputs($fp, "POST $path HTTP/1.1\r\n");
    fputs($fp, "Host: $host\r\n");

    if ($referer != '')
      fputs($fp, "Referer: $referer\r\n");

    fputs($fp, "Content-type: application/x-www-form-urlencoded\r\n");
    fputs($fp, "Content-length: ". strlen($data) ."\r\n");
    fputs($fp, "Connection: close\r\n\r\n");
    fputs($fp, $data);

    $result = '';
    while(!feof($fp)) {
      // receive the results of the request
      $result .= fgets($fp, 128);
    }
  }
  else {
    /*return array(
      'status' => 'err',
      'error' => "$errstr ($errno)"
    );*/
    return "$errstr ($errno)";
  }

  // close the socket connection:
  fclose($fp);

  // split the result header from the content
  $result = explode("\r\n\r\n", $result, 2);

  $header = isset($result[0]) ? $result[0] : '';
  $content = isset($result[1]) ? $result[1] : '';

  // added by Cui, Anqi, for chunked response
  $headers = _http_parse_headers($header);
  if (isset($headers['Transfer-Encoding']) && $headers['Transfer-Encoding'] == 'chunked') {
    $content = _http_chunked_decode($content);
  }

  /*// return as structured array:
  return array(
    'status' => 'ok',
    'header' => $header,
    'content' => $content
  );*/
  return $content;
}

// parse http headers. ref: http://php.net/manual/en/function.http-parse-headers.php
function _http_parse_headers ($header) {
  $retVal = array();
  $fields = explode("\r\n", preg_replace('/\x0D\x0A[\x09\x20]+/', ' ', $header));
  foreach ($fields as $field) {
    if (preg_match('/([^:]+): (.+)/m', $field, $match)) {
      $match[1] = preg_replace('/(?<=^|[\x09\x20\x2D])./e', 'strtoupper("\0")', strtolower(trim($match[1])));
      if (isset($retVal[$match[1]])) {
        $retVal[$match[1]] = array($retVal[$match[1]], $match[2]);
      } else {
        $retVal[$match[1]] = trim($match[2]);
      }
    }
  }
  return $retVal;
}

// decode chunked content. ref: http://php.net/manual/en/function.http-chunked-decode.php
    /**
     * dechunk an http 'transfer-encoding: chunked' message
     *
     * @param string $chunk the encoded message
     * @return string the decoded message.  If $chunk wasn't encoded properly it will be returned unmodified.
     */
    function _http_chunked_decode($chunk) {
        $pos = 0;
        $len = strlen($chunk);
        $dechunk = null;

        while(($pos < $len)
            && ($chunkLenHex = substr($chunk,$pos, ($newlineAt = strpos($chunk,"\n",$pos+1))-$pos)))
        {
            if (! is_hex($chunkLenHex)) {
                trigger_error('Value is not properly chunk encoded', E_USER_WARNING);
                return $chunk;
            }

            $pos = $newlineAt + 1;
            $chunkLen = hexdec(rtrim($chunkLenHex,"\r\n"));
            $dechunk .= substr($chunk, $pos, $chunkLen);
            $pos = strpos($chunk, "\n", $pos + $chunkLen) + 1;
        }
        return $dechunk;
    }


    /**
     * determine if a string can represent a number in hexadecimal
     *
     * @param string $hex
     * @return boolean true if the string is a hex, otherwise false
     */
    function is_hex($hex) {
        // regex is for weenies
        $hex = strtolower(trim(ltrim($hex,"0")));
        if (empty($hex)) { $hex = 0; };
        $dec = hexdec($hex);
        return ($hex == dechex($dec));
    } 

echo post_request('http://wing.comp.nus.edu.sg/~caq/mmseg/', array('t' => $_REQUEST['t'], 'removestop' => ''));
?>

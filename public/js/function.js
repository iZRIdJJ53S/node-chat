

function isURL (text) {
  if (text.length == 0) {
    return false;
  }
//  var regex = new RegExp(/(((ht|f)tp(s?))\:\/\/)([0-9a-zA-Z\-]+\.)+[a-zA-Z]{2,6}(\:[0-9]+)?(\/\S*)?/gi);
  //var domain = text.match(/([httpsfile]+:\/{2,3}(:?[0-9a-z\.\-:]+?)))/i)[1];
//  var regex = new RegExp("http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=]*)?");
//  var match_str = text.match(/(http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=]*)?)/);
  text.match(/(http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=:;_]*)?)/);

//  return regex.test(text);
  if (RegExp.$1 != null && RegExp.$1.length > 0) {
    return true;
  }
  return false;
}



function replaceURL (text) {
  if (text.length == 0) {
    return false;
  }
//  var regex = new RegExp(/(http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=]*)?)/);
  text = text.replace(/(http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=:;_]*)?)/, "<a href='$1' target='_blank'>$1</a>");
  //text = text.replace(/(http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=]*)?)/, '<a href="'+RegExp.$1+'">'+RegExp.$1+'</a>');
  return text;
}


function getURL (text) {
  if (text.length == 0) {
    return false;
  }
  text.match(/(http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-.\/?%&=:;_]*)?)/);
  if (RegExp.$1 != null && RegExp.$1.length > 0) {
    return RegExp.$1;
  }
  return false;
}

function setAttrSrcURL(url) {
  //$('#disparea_load').text('Loading... '+url);

  //$('#disparea').empty();
  $('#disparea').attr('src', url);

  //$('#disparea_load').empty();

  return false;
}

function __changeFormatTimeStamp (time_str, flg_include_time) {
  if (!time_str) {return false;}
  var d = new Date(time_str);
  var date_txt = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();

  // 時間を含むかどうかのフラグチェック
  if (flg_include_time) {
    date_txt += ' '+d.toLocaleTimeString();
  }

  return date_txt;
}




// htmlspecialchars
function __h(str) {

}

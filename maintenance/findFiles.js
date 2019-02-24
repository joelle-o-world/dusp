var fs = require("fs")

function findFiles(fileList, acceptableFileExtensions) {
  acceptableFileExtensions = acceptableFileExtensions || [".wav"]
  var list = []
  if (fileList.constructor == String) {
    fileList = [fileList]
  }

  for (var i in fileList) {
    var path = fileList[i]
    if (!fs.existsSync(path)) {
      console.log(path, "does not exist")
      continue
    }

    var extension = getExtension(path)
    if (extension && acceptableFileExtensions.indexOf(extension) != -1) {
      list.push(path)
    }
    if (!extension) {
      if (path[path.length - 1] != "/") path += "/"
      var pathContents = fs.readdirSync(path)
      for (var j in pathContents) pathContents[j] = path + pathContents[j]
      list = list.concat(findFiles(pathContents, acceptableFileExtensions))
      //console.log(fs.readdirSync(path));
    }
  }
  return list
}

function getExtension(path) {
  var index = path.lastIndexOf(".")
  if (index <= 0) return false
  else return path.slice(index)
}

module.exports = findFiles

const fs = require("fs").promises
const path = require("path")
const findFiles = require("./findFiles.js")

const patchDirectory = path.resolve("./src/patches")

async function compilePatchList() {

  var jsFiles = findFiles(patchDirectory, [".js"])
  var relPaths = jsFiles.map(absPath => path.relative(__dirname, absPath))
  var localPaths = jsFiles.map(absPath => path.relative(patchDirectory, absPath))

  var index = {}
  console.log("\nIndexing patches from", jsFiles.length, "files")
  for(var i in relPaths) {
    let mod = null
    try {
      mod = require(relPaths[i])
    } catch(e) {
      console.warn("\t", localPaths[i], "contains errors")
      continue
    }

    if(mod && mod.prototype && mod.prototype.isPatch) {
      var name = mod.name
      if(!index[name]) {
        index[name] = './'+localPaths[i]
        console.log("\tFOUND PATCH:", name, "at", index[name])
      } else
        console.warn("\tDUPLICATE PATCH:", name + "; discarding", localPaths[i], "in favour of", index[name])

    } else
      console.log("\tNOT A PATCH:", localPaths[i])
  }

  let lines = []
  for(var i in index) {
    let line = "\t"+i+": require(\""+index[i]+"\")"
    lines.push(line)
  }
  let indexScript = 'module.exports = {\n'+ lines.join(',\n')+'\n}'


  await fs.writeFile(
    path.resolve(patchDirectory, "index.js"),
    indexScript,
  )
  console.log("Updated index", path.resolve(patchDirectory, "patch_index.json"))
}

compilePatchList()

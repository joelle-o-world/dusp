const fs = require("fs").promises
const path = require("path")
const findFiles = require("./findFiles.js")

const componentDirectory = path.resolve("src/components")

async function compileComponentList() {

  var jsFiles = findFiles(componentDirectory, [".js"])
  var relPaths = jsFiles.map(absPath => path.relative(__dirname, absPath))
  var localPaths = jsFiles.map(absPath => path.relative(componentDirectory, absPath))

  var index = {}
  console.log("\nIndexing units from", jsFiles.length, "files")
  for(var i in relPaths) {
    let mod = null
    try {
      mod = require(relPaths[i])
    } catch(e) {
      console.warn("\t", localPaths[i], "contains errors")
      continue
    }

    if(mod && mod.prototype && mod.prototype.isUnit) {
      var name = mod.name
      if(!index[name]) {
        index[name] = './'+localPaths[i]
        console.log("\tFOUND UNIT:", name, "at", index[name])
      } else
        console.warn("\tDUPLICATE UNIT:", name, "discarding", localPaths[i], "in favour of", index[name])

    } else
      console.log("\tNOT A UNIT:", localPaths[i])
  }


  // generate a string
  let lines = []
  for(let i in index) {
    let line = '\t'+i + ": require(\"" + index[i] + "\")"
    lines.push(line)
  }

  let indexScript = "module.exports = {\n" + lines.join(",\n") + "\n}"

  await fs.writeFile(
    path.resolve(componentDirectory, "index.js"),
    indexScript
  )
  console.log("Updated index", path.resolve(componentDirectory, "component_index.json"))
}

compileComponentList()

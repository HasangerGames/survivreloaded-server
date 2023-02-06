const fs = require("fs");
let data = JSON.parse(fs.readFileSync("objects.json")/*, (key, value) => {
    if(key == "img" || key == "imgs" || key == "sound" || key == "hitParticle" || key == "explodeParticle") {
        return undefined;
    } else return value;
}*/);

function process(obj) {
    for(const key in obj) {
        /*if(typeof obj[key] === 'number') {
            obj[key] = +obj[key].toFixed(4);
        } else if(typeof obj[key] === 'object') {
            obj[key] = process(obj[key]);
        }*/
    }
    return obj;
}

data = process(data);
console.log(data["barrel_01"]["img"]);
fs.writeFileSync("objects2.json", JSON.stringify(data, null, 2));

// test with devicejs run listHiearchy.js

var utils = require("../devjsUtils.js").instance(dev$);


console.log("Getting heiarchy");

var ans = utils.getHierarchy().then(function(ans){
    var s= JSON.stringify(ans);
    console.log(s);
});





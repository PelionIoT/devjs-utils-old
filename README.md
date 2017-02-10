# devjs-utils
deviceJS utils, convenience library for dealing with collating with locations, interfaces, types

### Caching
Besides various collation and convenience functions, devjsUtils provides built-in caching. This means multiple calls will just use an in-memory cache instead of going back to the server. The optionals `ttl` in `options` on instance creation can change the cache timeout.

### Aliases
devjs-utils has alias commands, which let you use more friendly names for deviceIDs. These aliases are stored in your `ddb.shared` store in deviceDB, so your aliases will be usable across all Relays in the same site.

##### Example
```
utils.deviceAlias('RUNNER','internal_1').then(function(){
   console.log("RUNNER has an alias of internal_1"); 
});
```

you can now...

```
utils.selectByAlias('internal_1').then((sel) => {
    // sel works just like dev$('RUNNER')
    sel.listResources().then((result) => {
	    console.log("select by string:",result)
		assert('object',typeof result.RUNNER)
	})
})
```

### Documentation
See [DOC.md](DOC.md)

For example of alias commands, look at `test/test.js`


## Examples usage

    var utils = require("../devjsUtils.js").instance(dev$);
    
    console.log("Getting heiarchy");
    
    var ans = utils.getHierarchy().then(function(ans){
        var s= JSON.stringify(ans);
        console.log(s);
    });
    


## Tests

    cd tests
    devicejs run getHierarchy.js
    devicejs run test.js

    
## Using in browser
Use browserify

    node_modules/browserify/bin/cmd.js -r node_modules/devjs-utils/devjsUtils.js:devjsUtils [ other packages you need... ]  -o ../www/js/util-bundle.js

then in your code browser side code:
  
    var utils = require('devjsUtils').instance(dev$);
    

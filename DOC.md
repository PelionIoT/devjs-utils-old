# deviceJSUtils



#### Example

The constructor takes the form devJSUtils(_devjs,_devdb,opts) or
devJSUtils(_devjs,opts)
```
var utils = require("devjs-utils").instance(dev$);
console.log("Getting heiarchy");

var ans = utils.getHierarchy().then(function(ans){
   var s= JSON.stringify(ans);
   console.log(s);
});
``` 

## Methods

### listenToDeviceAllStates

A convenient way to watch a device's state, and not have to track / manage listeners.
This function provide a way to install a callback, which provide the same functionality of the following listener
creation code using the pure `dev$` selector.
```
var SEL = dev$.selectByID('WWFL00000Z');
var id = SEL.subscribeToState('+');
var listener = function(){console.warn("GOT IT",arguments);}
SEL.on('state',listener);
```
However, this method will provide the robustnesses of removing callbacks when their timer expires, not installing
multiple callbacks which do the same thing.

**Params**:  
*   id _String_

    The device ID.
*   uniq _String_

    A unique string of some sort.
*   callback _Function_

    [description]
*   opts _Object|Number_

    If a Number, it will be the `custom_ttl` value for this call back. After this TTL expire the callback
is removed. If an Object it is of the format:
```
{  
   custom_ttl: 10000,    // a number in ms
   ignore_cb_code: true  // if set, the callback code will not be looked at. This allows callbacks to replace each other, even if they are
                         // different code, as long as this option is used throughout (default is false)
}
```

#### Example

```
utils.listenToDeviceAllStates('WWFL000010','uniq',
   function(){console.warn("CALLBACK(3) for WWFL000010",arguments);},
   {custom_ttl:10000,ignore_cb_code:true} )
// then, calling the below will *replace* the above listener. This listener will be removed in 10 seconds.
utils.listenToDeviceAllStates('WWFL000010','uniq',
   function(){console.warn("CALLBACK(4) for WWFL000010",arguments);},
   {custom_ttl:10000,ignore_cb_code:true} )
```
This will install two listeners, which will both fire when `hsl` changes. They will both be removed in 100 seconds:
```
utils.listenToDeviceAllStates('WWFL000010','uniq',function(){console.warn("CALLBACK(2) for WWFL000010",arguments);},100000)
utils.listenToDeviceAllsState('WWFL000010','uniq',function(){console.warn("CALLBACK(1) for WWFL000010",arguments);},100000)
```
State change on `hsl` for device `WWFL000010` fires...
```
CALLBACK(2) for WWFL000010 ["WWFL000010", "hsl", Object]
CALLBACK(1) for WWFL000010 ["WWFL000010", "hsl", Object]
```

### listentoDeviceState

A robust way to listen to a device's state, which eliminates the need to track and manage listeners in the runtime.

**Params**:  
*   id _String_

    The device ID.
*   state_name _String_

    The event name of interest. For example `"brightness"`
*   uniq _String_

    A unique string of some sort.
*   callback _Function_

    [description]
*   opts _Object|Number_

    If a Number, it will be the `custom_ttl` value for this call back. After this TTL expire the callback
is removed. If an Object it is of the format:
```
{  
   custom_ttl: 10000,    // a number in ms
   ignore_cb_code: true  // if set, the callback code will not be looked at. This allows callbacks to replace each other, even if they are
                         // different code, as long as this option is used throughout (default is false)
}
```

#### Example

```
utils.listenToDeviceState('WWFL000010','hsl','uniq',
   function(){console.warn("CALLBACK(3) for WWFL000010",arguments);},
   {custom_ttl:10000,ignore_cb_code:true} )
// then, calling the below will *replace* the above listener. This listener will be removed in 10 seconds.
utils.listenToDeviceState('WWFL000010','hsl','uniq',
   function(){console.warn("CALLBACK(4) for WWFL000010",arguments);},
   {custom_ttl:10000,ignore_cb_code:true} )
```
This will install two listeners, which will both fire when `hsl` changes. They will both be removed in 100 seconds:
```
utils.listenToDeviceState('WWFL000010','hsl','uniq',function(){console.warn("CALLBACK(2) for WWFL000010",arguments);},100000)
utils.listenToDeviceState('WWFL000010','hsl','uniq',function(){console.warn("CALLBACK(1) for WWFL000010",arguments);},100000)
```
State change on `hsl` for device `WWFL000010` fires...
```
CALLBACK(2) for WWFL000010 ["WWFL000010", "hsl", Object]
CALLBACK(1) for WWFL000010 ["WWFL000010", "hsl", Object]
```

### listenToDevice

Handles the details of setting up a listener for a device event, with a callback. The callback will fire for `event_name`
for up to the default TTL or `custom_ttl`. After this, the callback will be purged. If there are no callback assigned for
an event, or they all timeout, then the listener is stopped. A single unique callback will never be in the list more than
once, and if called again on the same `callback` / `uniq` combination, the TTL value the purge time is just reset.

This function may be called more than once with the same unique identifier with no harm done. This allows a caller
to just always assign a callback, and if the code stops running, eventually the callback is cleared out.

This function is more efficient than setting up your own listeners per device, b/c it listens to all devices, and 
then calls the needed callbacks based on the event.

**Params**:  
*   id _String_

    The device ID.
*   event_name _String_

    The event name of interest. For example `"unreachable"`
*   uniq _String_

    A unique string of some sort.
*   callback _Function_

    The callback to be called.
*   custom_ttl _Number_

    A number in milliseconds to timeout the callback. After the timeout the callback is 
automatically removed. If not stated a default is used.

#### Example

```
devJSUtil.listenToDevice(id, 
    'unreachable',    // the event name of concern
    'sidebar',        // a unique identifier for the callback, so it's not inserted or called twice
    function (dev, id) {
        dev.reachable = false;
        dev.status = 'deactivated';
        console.log("device is unreachable",id);
    },
    30000  // callback will go away in 30 seconds (optional)
);
```

### preloadDeviceStatus

This asks deviceJS for all devices. It then stores all this as cache, so that if you ask for individual
devices, their status is already there. This is to speed up initial load of a web interface or mobile UI
which wants to ask for certain devices. A single call to deviceJS is much quicker. This gets the end user
out of the task of dealing with this.

This is not a cached call. It will overwrite all cached data. Always fulfills

### invalidateGraph

Invalidates devjs-utils internal graph, so that the next time a call is used
which needs the graph, it will be pulled again from the deviceJS runtime.

### invalidateResources

Invalidates the devjs-utils internal cache for resources.

### filterDeviceListByInterfaceRegex

given an array of device IDs, this will show only device IDs which have an interface for their
type which match a given regex

**Returns**: _Promse_ - A Promise which fulfills with an array which is a subset of the device ID array 
that have a matching interface for the given filter

**Params**:  
*   deviceids _Array_

    List of device IDs
*   interfacefilter _RegExp_

    A RegExp for filtering

#### Example

```
   dev$UtilsDEBUG.filterDeviceListByInterfaceRegex(['0017880a7876-1','LIFXd073d502b6ef','TunnelMonitor'],/Facades/)
```   
might return a Promise which fulfills with:
```
      {
         devices: ["LIFXd073d502b6ef","0017880a7876-1"],
         interfaces: ["Facades/hasWhiteTemp","Facades/Colorable","Facades/Switchable","Facades/Dimmable"]
      }
```

### getHierarchy

A utility to get the device heirarchy already flattened and parsed.
Provides the device hierarchy in three ways in an object which resolves as a complex object.

**Returns**: _Promise_ - resolves with said object
####Example

```
dev$UtilsDEBUG.getHierarchy().then(function(v){
   console.log(JSON.stringify(v));
});
```
might return
```
{
   "hierarchy":{
      "children":{
         "Dining Area":{
            "children":{
               "Subloc1":{
                  "children":{

                  },
                  "resources":{
                     "WWFL000010":{

                     }
                  }
               }
            },
            "resources":{
               "WWFL00000Z":{

               }
            }
         },
         "Upstairs":{
            "children":{

            },
            "resources":{
               "WWFL000010":{

               },
               "WWFL000016":{

               }
            }
         }
      },
      "resources":{

      }
   },
   "allDevices":{
      "WWFL00000Z":{
         "location":"Dining Area"
      },
      "WWFL000010":{
         "location":"Dining Area/Subloc1"
      },
      "WWFL000016":{
         "location":"Upstairs"
      }
   },
   "allLocationPaths":{
      "Dining Area":{
         "children":[
            "Subloc1"
         ],
         "resources":[
            "WWFL00000Z"
         ],
         "allResources":{     // all resources under this location & its sublocations
            "WWFL00000Z":1,
            "WWFL000010":1
         },
         "childInterfaces":{  // all interfaces under this location & its children
            Core/Interfaces/Unpairable: 1,
            Facades/Colorable: 1,
            Facades/Dimmable: 1,
            Facades/Switchable: 1,
            Facades/hasWhiteTemp: 1
         },
         "childTypes":{
            "Core/Devices/Lighting/WigwagDevices/Filament":1
         }
      },
      "Upstairs":{
         "children":[

         ],
         "resources":[
            "WWFL000010",
            "WWFL000016"
         ],
         "allResources":{
            "WWFL000010":1,
            "WWFL000016":1
         },
         "childInterfaces":{
            Core/Interfaces/Unpairable: 1,
            Facades/Colorable: 1,
            Facades/Dimmable: 1,
            Facades/Switchable: 1,
            Facades/hasWhiteTemp: 1
         },
         "childTypes":{
            "Core/Devices/Lighting/WigwagDevices/Filament":1
         }
      },
      "Dining Area/Subloc1":{
         "children":[

         ],
         "resources":[
            "WWFL000010"
         ],
         "allResources":{
            "WWFL000010":1
         },
         "childInterfaces":{
            Core/Interfaces/Unpairable: 1,
            Facades/Colorable: 1,
            Facades/Dimmable: 1,
            Facades/Switchable: 1,
            Facades/hasWhiteTemp: 1
         },
         "childTypes":{
            "Core/Devices/Lighting/WigwagDevices/Filament":1
         }
      }
   }
}
```

### listUnplacedDevices

Return a Promise which fulfills with a list of devices which are not in any resource groups.

**Returns**: _Promise_ - Promise which fulfills with above object

### listPlacedDevices

Return a Promise which fulfills with a list of devices which are in at least one resource group.

**Returns**: _Promise_ - Promise which fulfills with above object

## #listAllDevices

Returns an Array of all device names. This will used cache if available.

**Returns**: _Promise_ - Promise which fulfills with above object

### listDeviceStatus

Build a list of the format 
``` 
   [{ 'IDabc' : { 
        registered: true, 
        reachable: false, 
        [ other data... ] 
   }, 'IDxyz' : { 
       registered: ...
       ...
   }, 
   ... more devices
   ]
```
from a given list of device IDs. If a device ID is not known by deviceJS it is reported `null`

**Returns**: _Promise_ - which will resolve to the given list

**Params**:  
*   list _Array|device ID_

    List of device IDs to provide status, as an `Array` of `String`


### listExcludedResourceIDs

returns a list of devices which are accounted for by deviceJS but are not in the given
Array of device IDs. The collection should be keyed by resource ID.

**Returns**: _Promise_ - resolves to an Array of device IDs not in 'list'

**Params**:  
*   list _Array_

    of device IDs


###listInterfaceTypes

list all interface types

**Returns**: _Promise_ - a Promise which fulfills with state value

###listTypesOfDevices

Get a list of types from a list of devices

**Returns**: _Promise_ - which fulfills with an Array of 'Resource Types' the device(s) belongs to. The list is in no particular order.

**Params**:  
*   id _Array|string_

    A string or Array of device IDs


### listResourceTypes

Lists all resource types know about by deviceJS

**Returns**: _Promise_ - which will resolve to the given list

###listInterfacesOfTypes

Get a list of interfaces from a list of resource types.

**Returns**: _Promise_ - which fulfills with an Array of 'Interfaces' the 'Resource Type(s)' implement. The list is in no particular order.

**Params**:  
*   id _Array|string_

    A string or Array of device IDs


### listInterfacesOfDevices

Get a list of interfaces a device implements

**Returns**: _Promise_ - which fulfills with an Array of Interfaces the device(s) implement. The list is in no particular order.

**Params**:  
*   id _Array|string_

    A string or Array of device IDs


### moveDevice

Moves a device from one resource group to another by stated paths. Places the device in the given resource group
then removes the device from the other resouece group.

**Returns**: _Promise_ - A Promise which fulfills when the entire operation is complete

**Params**:  
*   id _String_

    The device ID of the resource
*   frompath _String_

    The String path where the device should 'moved' from.
*   topath _String_

    The String path where the device should 'moved' to.


### moveResourceGroup

This works just like the 'mv' command in Unix. A new resource group is created, if it does not already exist. All devices are joined to
this resource group, then devices are removed form the old resource group, then the empty resource group is removed. 'sub resource groups'
or 'folders' (if looking at it using the file system metaphor) are supported, and the function will recursively handle them.

**Returns**: _Promise_ - which fulfills when the move is complete.

**Params**:  
*   from _String_

    a path
*   to _String_

    new path
*   graph _Object_

    Optional. results from dev$.getResourceGroup('') If not provided this will be pulled from
cache in devJSUtils


### deviceAlias

Sets or gets a device alias. If a 'newname' is provided, the method will 
set the alias name for a specific device ID. Device IDs may only have one alias
using this routine.

**Returns**: _[type]_ - [description]

**Params**:  
*   devid _[type]_

    [description]
*   newname _[type]_

    [description]


### getIdByAlias

Returns a device ID given an alias

**Returns**: _[type]_ - [description]

**Params**:  
*   alias _[type]_

    [description]


### removeAllAliases

Use with caution folks. Erases all alias data.

**Returns**: _[type]_ - [description]

###findAllAliases

This returns all aliases / device ID pairs, which match a particular pattern
of an alias. That pattern is represented as a regex. If a function is provided,
then that function is called every time a match is found.

**Returns**: _Promise_ - A Promise which fulfills with an object that is a map
of all matches. Each key is an alias, each value is the device ID. If no matches
are found, an empty object is returned.

**Params**:  
*   regex _Regex_

    Regex to match against
*   func _Function_

    options function to call on each match

#### Example

```
   utils.deviceAlias('RUNNER','internal_1')
   utils.deviceAlias('Rules','internal_2')

   // then, after above calls complete (they asynchronous and return promises)
   
   var foundsome = function(alias,id){
       console.log("Alias found:",alias,id);
   }
   utils.findAllAliases(/internal_.*$/,foundsome).then(function(map){
       console.log("map:",map);
       var aliases = Object.keys(map);
       assert(aliases.length, CHEESE_NUMS);
   })
```
Output
```
   Alias found: internal_1 RUNNER
   Alias found: internal_2 Rules
   maps: { RUNNER: 'internal_1'
       Rules: 'internal_2'
   }
```


### selectByAlias

This returns the equivalent of using dev$.selectByID(id), if selecting
one or more devices, but by alias instead.

**Returns**: _Promise_ - returns a Promise which fulfills with the selection, which would be the same as the 
result of a call to dev$('id=XYZ') if the parameter passed used an alias which mapped to device ID 'XYZ'.

**Params**:  
*   regex _Regex|String_

    A regex or a string

#### Example

```
   utils.deviceAlias('RUNNER','internal_1')
   utils.deviceAlias('Rules','internal_2')
   //
   // then later (bear in mind deviceAlias commands don't finish until their
   // Promise fulfills) ...
   //
   utils.selectByAlias(/internal.*$/).then(function(sel){
      sel.listResources().then(function(res){
          console.log("Select by regex:",res);
          assert('object',typeof res.RUNNER)
          assert('object',typeof res.Rules)
      });
   })
```


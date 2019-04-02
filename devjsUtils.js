/*
 * Copyright (c) 2018, Arm Limited and affiliates.
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Created by ed on 11/6/15.
 * Updated 2/7/2017
 */
var Cache = require('js-cache');
var Promise = require('es6-promise').Promise;
var _ = require('lodash');
var orderedTable = require('./orderedTable.js');
var path = require('path');


var ON_log_dbg = function() {
    //var args = Array.prototype.slice.call(arguments);
    //args.unshift("WebDeviceSim");
    if(global.log)
        log.debug.apply(log,arguments);
    else
        console.log.apply(console,arguments);
};

var log_err = function() {
    if(global.log)
        log.error.apply(log,arguments);
    else {
        var args = Array.prototype.slice.call(arguments);
        args.unshift("ERROR");
        console.error.apply(console,args);
    }

};


var log_warn = function() {
    if(global.log)
        log.warn.apply(log,arguments);
    else {
        var args = Array.prototype.slice.call(arguments);
        args.unshift("WARN");
        console.error.apply(console,args);
    }
};



var get_paths = function(s) {
    var delim = '/';
    var ret = [];
    if(typeof s == 'string') {
        var ans = s.split(delim);
        if(ans.length > 0 && ans[0].length == 0) {
            ans.shift(); // skip the '/'
        }
        var l = ans.length;
        var r = 0;
        while(r < l) {
            var s = ans[0];
            for(var p = 1;p<(r+1);p++) {
                if(ans[p].length > 0) {
                    s += delim; s += ans[p];
                } else {
                    return ret; // just get out if the last split was .length = 0
                }
            }
            ret[r] = s;
            r++;
        }
        return ret;
    } else {    
        return [];
    }
}
// var s1 = "/hey/now/you/s";
//    var s1 = "hey/now/you/s";
//    var s1 = "hey/now/you/";
// 
// console.log("",s1," is ",get_paths(s1)); 
// returns  /hey/now/you/s  is  [ 'hey', 'hey/now', 'hey/now/you', 'hey/now/you/s' ]


/**
 * @class  deviceJSUtils
 * @constructor
 * @param  {Object} _devjs A deviceJS instance. typically `dev$`
 * @params {object} [_devdb] A devicedb instance
 * @param  {Object} [opts]  An options object
 * @example
 * The constructor takes the form devJSUtils(_devjs,_devdb,opts) or
 * devJSUtils(_devjs,opts)
 * ```
 * var utils = require("devjs-utils").instance(dev$);
 * console.log("Getting heiarchy");
 * 
 * var ans = utils.getHierarchy().then(function(ans){
 *    var s= JSON.stringify(ans);
 *    console.log(s);
 * });
 * ``` 
 */
var devJSUtils = function(_devjs,_devdb,opts) {
    var cache = null;

    var devJS = _devjs;
    var ddb = null;

    this.assignDevJS = function(_devjs) {
        devJS = _devjs;
    };

    this.assignDevicedb = function(_devdb) {
        ddb = _devdb;
    };

    var _self = this;
    var TTL = 30000;  // 30 seconds
    var ListenTTL = 1000*60*10; // 10 minutes...

    var log_dbg = function() {

    };

    // opts was not defined, then maybe it was the second parameter
    if(opts === undefined) {
        opts = _devdb;
    } else {
        ddb = _devdb;
    }

    if(opts) {
        if(opts.default_timeout != undefined) TTL = opts.default_timeout;
        if(opts.listener_timeout != undefined) ListenTTL = opts.listener_timeout;
        if(opts.debug_mode) {
            log_dbg = ON_log_dbg;
        }
        if(typeof opts.debug_console_func == 'function') {
            log_dbg = opts.debug_console_func;
        }
        if(opts.set_cache) {
            cache = set_cache;
        }
    }

    if(!cache)
        cache = new Cache();

    var hash_callback = function(id,event_name,uniq,callback) {
        return ""+id+':'+uniq+"{"+event_name+"}"+callback; // 'callback' will be cast to a string
    };
    var hash_id_event = function(id,event_name) {
        return ""+id+"{"+event_name+"}"; // 'callback' will be cast to a string
    };

    var emitter_event_cb_count = null;


    this.clearCache = function() {
        cache = new Cache();
    };

    var cacheKeyDeviceListResources = function(id) {
        return 'select(id="'+id+'").listResources()';
    };

    var CACHE_DEVICE_LIST = "$DEVICE_LIST";
    var CACHE_PLACED_DEVICE_LIST = "$PLACED";
    var CACHE_UNPLACED_DEVICE_LIST = "$UNPLACED";
    var CACHE_WALK_GRAPH_ALL="all$walkGraph";

    var callback_tables = {};  // event_name:orderedTable
    var state_callback_tables = {};
    var allstates_table = null;

    this.clearListeners = function() {
        var keyz = Object.keys(callback_tables);
        for(var n=0;n<keyz.length;n++) {
            if(callback_tables[keyz[n]].devjs_selection) {
                callback_tables[keyz[n]].devjs_selection.removeAllListeners();
//                callback_tables[keyz[n]].devjs_selection.unsubscribeFromEvent(callback_tables[keyz[n]].event_label);
                callback_tables[keyz[n]].devjs_selection.unsubscribe(callback_tables[keyz[n]].subscribe_id);
            }
        }
        callback_tables = {};  // event_name:orderedTable
        keyz = Object.keys(state_callback_tables);
        for(var n=0;n<keyz.length;n++) {
            if(state_callback_tables[keyz[n]].devjs_selection) {
                state_callback_tables[keyz[n]].devjs_selection.removeAllListeners();
//                state_callback_tables[keyz[n]].devjs_selection.unsubscribeFromState(state_callback_tables[keyz[n]].event_label);
                state_callback_tables[keyz[n]].devjs_selection.unsubscribe(state_callback_tables[keyz[n]].subscribe_id);                
            }
        }
        state_callback_tables = {};  // event_name:orderedTable
        if(allstates_table) {
            if(allstates_table.devjs_selection) {
                allstates_table.devjs_selection.removeAllListeners();
//                allstates_table.devjs_selection.unsubscribeFromState('+');                
                allstates_table.devjs_selection.unsubscribe(allstates_table.subscribe_id);                
            }
        }
        allstates_table = null;
    }



    /**
     * A convenient way to watch a device's state, and not have to track / manage listeners.
     * This function provide a way to install a callback, which provide the same functionality of the following listener
     * creation code using the pure `dev$` selector.
     * ```
     * var SEL = dev$.selectByID('WWFL00000Z');
     * var id = SEL.subscribeToState('+');
     * var listener = function(){console.warn("GOT IT",arguments);}
     * SEL.on('state',listener);
     * ```
     * However, this method will provide the robustnesses of removing callbacks when their timer expires, not installing
     * multiple callbacks which do the same thing.
     * @method  listenToDeviceAllStates
     * @param {String} id The device ID.
     * @param {String} uniq A unique string of some sort.
     * @param  {Function} callback   [description]
     * @param  {Object|Number}   opts If a Number, it will be the `custom_ttl` value for this call back. After this TTL expire the callback
     * is removed. If an Object it is of the format:
     * ```
     * {  
     *    custom_ttl: 10000,    // a number in ms
     *    ignore_cb_code: true  // if set, the callback code will not be looked at. This allows callbacks to replace each other, even if they are
     *                          // different code, as long as this option is used throughout (default is false)
     * }
     * ``` 
     * @example
     * ```
     * utils.listenToDeviceAllStates('WWFL000010','uniq',
     *    function(){console.warn("CALLBACK(3) for WWFL000010",arguments);},
     *    {custom_ttl:10000,ignore_cb_code:true} )
     * // then, calling the below will *replace* the above listener. This listener will be removed in 10 seconds.
     * utils.listenToDeviceAllStates('WWFL000010','uniq',
     *    function(){console.warn("CALLBACK(4) for WWFL000010",arguments);},
     *    {custom_ttl:10000,ignore_cb_code:true} )
     * ```
     * This will install two listeners, which will both fire when `hsl` changes. They will both be removed in 100 seconds:
     * ```
     * utils.listenToDeviceAllStates('WWFL000010','uniq',function(){console.warn("CALLBACK(2) for WWFL000010",arguments);},100000)
     * utils.listenToDeviceAllsState('WWFL000010','uniq',function(){console.warn("CALLBACK(1) for WWFL000010",arguments);},100000)
     * ```
     * State change on `hsl` for device `WWFL000010` fires...
     * ```
     * CALLBACK(2) for WWFL000010 ["WWFL000010", "hsl", Object]
     * CALLBACK(1) for WWFL000010 ["WWFL000010", "hsl", Object]
     * ```
     */
    this.listenToDeviceAllStates = function(id,uniq,callback,opts) {
    // TODO - implement state listening version
        if(arguments.length < 4)
            throw new Error("Invalid number of parameters");

        var custom_ttl = undefined;
        var ignore_cb_code = false;
        if(typeof opts === 'number') custom_ttl = opts;
        if(typeof opts === 'object') {
            if(opts.custom_ttl) custom_ttl = opts.custom_ttl;
            if(opts.ignore_cb_code) ignore_cb_code = true;
        }
        if(ignore_cb_code)
            var cb_name = hash_callback(id,"",uniq,"");
        else
            var cb_name = hash_callback(id,"",uniq,callback);
        if(!allstates_table) {
            allstates_table = {
                cache: new Cache(),  // used to track when you should remove a callback handler
                table: new orderedTable(),
                master_callback: null,
                devjs_selection: null
            };
// CALLBACK_STATE ["WWFL00000Z", "brightness", 0.4]
            allstates_table.master_callback = function (id, eventlabel) {
                log_dbg("in state master_callback()",arguments);
                // if (allstates_table.event_label == eventlabel) {
                    log_dbg("got (master ..AllStates) event state:",eventlabel);
                    var argz = arguments;
                    allstates_table.table.forEach(function (val, tableid, order) {
                        if (val && val.id == id) {
                            if (typeof(val.cb) == 'function') {
                                val.cb.apply(undefined, argz);
                            } else {
                                log_err("Bad entry as callback in devjsUtils.listenToDevice");
                            }
                        }
                    });
                // }
            };

            allstates_table.devjs_selection = devJS.select('id=*'); // this seems in efficient, but right now its better.
                                // the devicejs engine does not deal well with many subscribers at the moment

            // emitter_event_cb_count = table.devjs_selection._peer.listenerCount('event');
            // emitter_event_cb_count++;

            // FIXME see DVJS-456
            allstates_table.devjs_selection._peer.setMaxListeners(emitter_event_cb_count + 10);
            allstates_table.devjs_selection.setMaxListeners(emitter_event_cb_count + 10);
            //}
//            log_dbg("on() selection:"+'id="'+id+'"');
            log_dbg("on() selection:" + 'id=*');
//            table.devjs_selection.subscribeToEvent(event_name);
//            table.devjs_selection.on('event', table.master_callback);
            allstates_table.devjs_selection.on('state',allstates_table.master_callback);           

            allstates_table.cache.on('del', function (key) {
                log_dbg("delete key (callback cache timeout) [",key,"]");
                allstates_table.table.remove(key);
                if (allstates_table.cache.size() < 1) {
                    // remove callback
                    log_dbg("unsubscribe('"+"') FromState");
//                    allstates_table.devjs_selection.unsubscribeFromState('+');
                    allstates_table.devjs_selection.unsubscribe(allstates_table.subscribe_id);                    
                }
            });
        }
        //} else if(table.cache.size() < 1) {
        //    // add listener / callback
        //    table.devjs_selection = devJS.select('id="*"'); // this seems in efficient, but right now its better.
        //                                                    // the devicejs enginer does not deal well with many subscribers at the moment
        //    log_dbg("here1");
        //    //table.devjs_selection.subscribeToEvent(event_name);
        //}

        allstates_table.subscribe_id = allstates_table.devjs_selection.subscribeToState('+'); //.then(function(){});

        if(typeof custom_ttl == 'number')
            allstates_table.cache.set(cb_name,cb_name,custom_ttl); // refresh or update cached
        else
            allstates_table.cache.set(cb_name,cb_name,ListenTTL); // refresh or update cached
        var device_callback = {
            cb: callback,
            id: id
        };
        allstates_table.table.replaceAdd(cb_name,device_callback);   // add/re-add to table
    };

    /**
     * A robust way to listen to a device's state, which eliminates the need to track and manage listeners in the runtime.
     * @method  listentoDeviceState
     * @param {String} id The device ID.
     * @param {String} state_name The event name of interest. For example `"brightness"`
     * @param {String} uniq A unique string of some sort.
     * @param  {Function} callback   [description]
     * @param  {Object|Number}   opts If a Number, it will be the `custom_ttl` value for this call back. After this TTL expire the callback
     * is removed. If an Object it is of the format:
     * ```
     * {  
     *    custom_ttl: 10000,    // a number in ms
     *    ignore_cb_code: true  // if set, the callback code will not be looked at. This allows callbacks to replace each other, even if they are
     *                          // different code, as long as this option is used throughout (default is false)
     * }
     * ``` 
     * @example
     * ```
     * utils.listenToDeviceState('WWFL000010','hsl','uniq',
     *    function(){console.warn("CALLBACK(3) for WWFL000010",arguments);},
     *    {custom_ttl:10000,ignore_cb_code:true} )
     * // then, calling the below will *replace* the above listener. This listener will be removed in 10 seconds.
     * utils.listenToDeviceState('WWFL000010','hsl','uniq',
     *    function(){console.warn("CALLBACK(4) for WWFL000010",arguments);},
     *    {custom_ttl:10000,ignore_cb_code:true} )
     * ```
     * This will install two listeners, which will both fire when `hsl` changes. They will both be removed in 100 seconds:
     * ```
     * utils.listenToDeviceState('WWFL000010','hsl','uniq',function(){console.warn("CALLBACK(2) for WWFL000010",arguments);},100000)
     * utils.listenToDeviceState('WWFL000010','hsl','uniq',function(){console.warn("CALLBACK(1) for WWFL000010",arguments);},100000)
     * ```
     * State change on `hsl` for device `WWFL000010` fires...
     * ```
     * CALLBACK(2) for WWFL000010 ["WWFL000010", "hsl", Object]
     * CALLBACK(1) for WWFL000010 ["WWFL000010", "hsl", Object]
     * ```
     */
    this.listenToDeviceState = function(id,state_name,uniq,callback,opts) {
    // TODO - implement state listening version
        if(arguments.length < 4)
            throw new Error("Invalid number of parameters");

        var custom_ttl = undefined;
        var ignore_cb_code = false;
        if(typeof opts === 'number') custom_ttl = opts;
        if(typeof opts === 'object') {
            if(opts.custom_ttl) custom_ttl = opts.custom_ttl;
            if(opts.ignore_cb_code) ignore_cb_code = true;
        }
        if(ignore_cb_code)
            var cb_name = hash_callback(id,state_name,uniq,"");
        else
            var cb_name = hash_callback(id,state_name,uniq,callback);
        var table_name = state_name;
        var table = state_callback_tables[table_name];
        if(!table) {
            table = state_callback_tables[table_name] = {
                cache: new Cache(),  // used to track when you should remove a callback handler
                table: new orderedTable(),
                master_callback: null,
                event_label: state_name,
                devjs_selection: null
            };
// CALLBACK_STATE ["WWFL00000Z", "brightness", 0.4]
            table.master_callback = function (id, eventlabel) {
                log_dbg("in state master_callback()",arguments);
                if (table.event_label == eventlabel) {
                    log_dbg("got associated event state:",eventlabel);
                    var argz = arguments;
                    table.table.forEach(function (val, tableid, order) {
                        if (val && val.id == id) {
                            if (typeof(val.cb) == 'function') {
                                val.cb.apply(undefined, argz);
                            } else {
                                log_err("Bad entry as callback in devjsUtils.listenToDevice");
                            }
                        }
                    });
                }
            };

            table.devjs_selection = devJS.select('id=*'); // this seems in efficient, but right now its better.
                                // the devicejs engine does not deal well with many subscribers at the moment

            // emitter_event_cb_count = table.devjs_selection._peer.listenerCount('event');
            // emitter_event_cb_count++;

            // FIXME see DVJS-456
            table.devjs_selection._peer.setMaxListeners(emitter_event_cb_count + 10);
            table.devjs_selection.setMaxListeners(emitter_event_cb_count + 10);
            //}
//            log_dbg("on() selection:"+'id="'+id+'"');
            log_dbg("on() selection:" + 'id=*');
//            table.devjs_selection.subscribeToEvent(event_name);
//            table.devjs_selection.on('event', table.master_callback);
            table.devjs_selection.on('state',table.master_callback);           

            table.cache.on('del', function (key) {
                log_dbg("delete key (callback cache timeout) [",key,"]");
                table.table.remove(key);
                if (table.cache.size() < 1) {
                    // remove callback
                    log_dbg("unsubscribeFromState('",table.event_label,"'");
                    table.devjs_selection.unsubscribeFromState(table.event_label);
                }
            });
        }
        //} else if(table.cache.size() < 1) {
        //    // add listener / callback
        //    table.devjs_selection = devJS.select('id="*"'); // this seems in efficient, but right now its better.
        //                                                    // the devicejs enginer does not deal well with many subscribers at the moment
        //    log_dbg("here1");
        //    //table.devjs_selection.subscribeToEvent(event_name);
        //}

        table.subscribe_id = table.devjs_selection.subscribeToState(state_name); //.then(function(){});

        if(typeof custom_ttl == 'number')
            table.cache.set(cb_name,cb_name,custom_ttl); // refresh or update cached
        else
            table.cache.set(cb_name,cb_name,ListenTTL); // refresh or update cached
        var device_callback = {
            cb: callback,
            id: id
        };
        table.table.replaceAdd(cb_name,device_callback);   // add/re-add to table
    };


    /**
     * Handles the details of setting up a listener for a device event, with a callback. The callback will fire for `event_name`
     * for up to the default TTL or `custom_ttl`. After this, the callback will be purged. If there are no callback assigned for
     * an event, or they all timeout, then the listener is stopped. A single unique callback will never be in the list more than
     * once, and if called again on the same `callback` / `uniq` combination, the TTL value the purge time is just reset.
     *
     * This function may be called more than once with the same unique identifier with no harm done. This allows a caller
     * to just always assign a callback, and if the code stops running, eventually the callback is cleared out.
     *
     * This function is more efficient than setting up your own listeners per device, b/c it listens to all devices, and 
     * then calls the needed callbacks based on the event.
     *
     * @method listenToDevice
     * @example
     * ```
     * devJSUtil.listenToDevice(id, 
     *     'unreachable',    // the event name of concern
     *     'sidebar',        // a unique identifier for the callback, so it's not inserted or called twice
     *     function (dev, id) {
     *         dev.reachable = false;
     *         dev.status = 'deactivated';
     *         console.log("device is unreachable",id);
     *     },
     *     30000  // callback will go away in 30 seconds (optional)
     * );
     * ```
     * @param {String} id The device ID.
     * @param {String} event_name The event name of interest. For example `"unreachable"`
     * @param {String} uniq A unique string of some sort.
     * @param {Function} callback The callback to be called.
     * @param {Number} [custom_ttl] A number in milliseconds to timeout the callback. After the timeout the callback is 
     * automatically removed. If not stated a default is used.
     */
    this.listenToDevice = function(id,event_name,uniq,callback,custom_ttl) {
        if(arguments.length < 4)
            throw new Error("Invalid number of parameters");

        var cb_name = hash_callback(id,event_name,uniq,callback);
//        var table_name = hash_id_event(id,event_name);
        var table_name = event_name;
        var table = callback_tables[table_name];
        if(!table) {
            table = callback_tables[table_name] = {
                cache: new Cache(),  // used to track when you should remove a callback handler
                table: new orderedTable(),
                master_callback: null,
                event_label: event_name,
                devjs_selection: null
            };

            table.master_callback = function (id, eventlabel) {
                log_dbg("in master_callback()");
                if (table.event_label == eventlabel) {
                    log_dbg("got associated event:",eventlabel);
                    var argz = arguments;
                    table.table.forEach(function (val, tableid, order) {
                        if (val && val.id == id) {
                            if (typeof(val.cb) == 'function') {
                                val.cb.apply(undefined, argz);
                            } else {
                                log_err("Bad entry as callback in devjsUtils.listenToDevice");
                            }
                        }
                    });
                }
            };

            table.devjs_selection = devJS.select('id=*'); // this seems in efficient, but right now its better.
                                // the devicejs engine does not deal well with many subscribers at the moment
            //log_dbg('selection', table.devjs_selection);
            //if(emitter_event_cb_count === null) {
            emitter_event_cb_count = table.devjs_selection._peer.listenerCount('event');
            //}
            emitter_event_cb_count++;
            //if((emitter_event_cb_count+1) > table.devjs_selection.listeners('event').length) {
            //    log_dbg('bump MaxListeners->',emitter_event_cb_count + 10);
            // FIXME see DVJS-456
            table.devjs_selection._peer.setMaxListeners(emitter_event_cb_count + 10);
            table.devjs_selection.setMaxListeners(emitter_event_cb_count + 10);
            //}
//            log_dbg("on() selection:"+'id="'+id+'"');
            log_dbg("on() selection:" + 'id=*');
            table.subscribe_id = table.devjs_selection.subscribeToEvent(event_name);
            table.devjs_selection.on('event', table.master_callback);

            table.cache.on('del', function (key) {
                log_dbg("delete key (callback cache timeout) [",key,"]");
                table.table.remove(key);
                if (table.cache.size() < 1) {
                    // remove callback
                    table.devjs_selection.unsubscribeFromEvent(table.event_label);
                }
            });
        }
        //} else if(table.cache.size() < 1) {
        //    // add listener / callback
        //    table.devjs_selection = devJS.select('id="*"'); // this seems in efficient, but right now its better.
        //                                                    // the devicejs enginer does not deal well with many subscribers at the moment
        //    log_dbg("here1");
        //    //table.devjs_selection.subscribeToEvent(event_name);
        //}

        if(typeof custom_ttl == 'number')
            table.cache.set(cb_name,cb_name,custom_ttl); // refresh or update cached
        else
            table.cache.set(cb_name,cb_name,ListenTTL); // refresh or update cached
        var device_callback = {
            cb: callback,
            id: id
        };
        table.table.replaceAdd(cb_name,device_callback);   // add/re-add to table
    };


    var _uncachedGetAllResources = function() {
        return new Promise(function(resolve,reject) {
            devJS.select('id=*').listResources().then(function (r) {
                var ky = 'select("id=*").listResources()';
                cache.set(ky, r, TTL);
                var keyz = Object.keys(r);
                var devlist = [];
                for (var n = 0; n < keyz.length; n++) {
                    var obj = {};
                    obj[keyz[n]] = r[keyz[n]];
                    log_dbg("cache <- ", obj);
                    devlist.push(keyz[n]);
                    cache.set(cacheKeyDeviceListResources(keyz[n]), obj, TTL);
                }
                cache.set(CACHE_DEVICE_LIST, keyz, TTL); // store a simple list of device IDs also...
                resolve({keyz:keyz});
            }).catch(function (err) {
                log_err("_uncachedGetAllResources: API error", err);
                reject(err);
            });
        });
    };

    /**
     * This asks deviceJS for all devices. It then stores all this as cache, so that if you ask for individual
     * devices, their status is already there. This is to speed up initial load of a web interface or mobile UI
     * which wants to ask for certain devices. A single call to deviceJS is much quicker. This gets the end user
     * out of the task of dealing with this.
     *
     * This is not a cached call. It will overwrite all cached data. Always fulfills
     *
     * @method  preloadDeviceStatus
     */
    this.preloadDeviceStatus = function() {
        var self = this;
        return new Promise(function(resolve,reject) {
            devJS.select('id=*').listResources().then(function (r) {
                var ky = 'select("id=*").listResources()';
                cache.set(ky,r,TTL);
                var keyz = Object.keys(r);
                var devlist = [];
                for (var n=0;n<keyz.length;n++) {
                    var obj = {};
                    obj[keyz[n]] = r[keyz[n]];
                    log_dbg("cache <- ", obj);
                    devlist.push(keyz[n]);
                    cache.set(cacheKeyDeviceListResources(keyz[n]),obj,TTL);
                }

                cache.set(CACHE_DEVICE_LIST,devlist,TTL); // store a simple list of device IDs also...

                var proms = [];

                proms.push(self.listTypesOfDevices(keyz).catch(function(err){
                    log_err("preloadDeviceStatus","Error back from deviceJS API:", err);
                    //resolve();
                }));


                proms.push(self.listInterfaceTypes());

                proms.push(devJS.listResourceTypes().then(function (r) {
                    var ky = "listResourceTypes()";
                    cache.set(ky, r, TTL * 3); // give it a bigger TTL, this rarely changes
                }).catch(function(err){
                    log_err("preloadDeviceStatus","Error back from deviceJS API (2):", err);
                    //resolve();
                }));

                Promise.all(proms).then(function(){
                    resolve();
                },function(){
                    log_err("API Errors in preloadDeviceStatus()");
                    resolve();
                });

            }, function (err) {
                log_err("preloadDeviceStatus","Error back from deviceJS API (3):", err);
                resolve();
            });
        });
    };


    /**
     * Invalidates devjs-utils internal graph, so that the next time a call is used
     * which needs the graph, it will be pulled again from the deviceJS runtime.
     *
     * @method invalidateGraph
     */
    this.invalidateGraph = function() {
        var ky = "getResourceGroup('')";
        cache.del(ky);
    };

    /**
     * Invalidates the devjs-utils internal cache for resources. 
     *
     * @method invalidateResources
     */
    this.invalidateResources = function() {
        var ky = 'select("id=*").listResources()';
        cache.del(ky);
    };

    /**
     * A cached call to `dev$.getResourceGroup('')`
     * @return {Promise} which fulfills with the resource tree. 
     */
    this.getResourceTree = function() {
        return new Promise(function(resolve,reject) {
            var ky = "getResourceGroup('')";
            var ret = cache.get(ky);
            if(!ret) {
                devJS.getResourceGroup('').then(function(ret){
                    cache.set(ky,ret,TTL);
                    resolve(ret);
                }).catch(function(e){
                    log_err("getResourceTree - API failure:",e);
                    reject(e);
                });
            } else {
                resolve(ret);
            }
        });
    };


    // non recursize graph walk...
    var walkGraph = function(graph) {
        var hierarchy = graph.hierarchy;
        graph.allDevices = {};
        graph.allLocationPaths = {};

        var aux_proms = []; // promises of secondary queries on devices.

        var stack = []; // hold a path to where we are in the graph (a tree path)

        var get_ifs = function(paths,typenames) {
            return _self.listInterfacesOfTypes(typenames).then(function(iflist){
                log_dbg("***************** 1 get_ifs ");
                var p = paths.length;
                while(p--) {
                log_dbg("***************** 1.1 get_ifs ",paths[p]);
                    var q = iflist.length;
                    while(q--) { // merge into interface list
                        graph.allLocationPaths[paths[p]].childInterfaces[iflist[q]] = 1;
                    }
                }
                                log_dbg("***************** 2 get_ifs ");
            });
        }


        var get_aux_data = function(list,paths) {   
            log_dbg("***************** 1 get_aux_data ",list,paths);                               
            var p2 = list.length;
            while(p2--) {
                // var p = stackcopy.length;
                var p = paths.length;
                log_dbg("***************** 2.05 get_aux_data ",list[p2]);                                
                while(p--) { // merge into types list
                    graph.allLocationPaths[paths[p]].allResources[list[p2]] = 1;
                }
            } 

            aux_proms.push(
                _self.listTypesOfDevices(list).then(function(typelist){
                    log_dbg("***************** 2.1 get_aux_data ");                                
                    var q = typelist.length;
                    while(q--) {
                        var p = paths.length;
                                            log_dbg("***************** 2.2 get_aux_data ");                                
                        while(p--) { // merge into types list
                            graph.allLocationPaths[paths[p]].childTypes[typelist[q]] = 1;
                        }                    
                    }
                    aux_proms.push(get_ifs(paths,typelist).catch(function(e){
                        log_err("@catch get_aux_data",e);
                    })
                    );
                })
            );
                        log_dbg("***************** 3 get_aux_data ");                                
        }

        var grab_resources = function(res,locationpath) {
            var keyz = Object.keys(res);
            var pathz = get_paths(locationpath)
            for(var n=0;n<keyz.length;n++) {
                log_dbg("..found device:",keyz[n],"@",locationpath);
                //graph.allDevices[keyz[n]] = res[keyz[n]];
                graph.allDevices[keyz[n]] = {
                    location: locationpath
                };
                graph.allLocationPaths[locationpath].allResources[keyz[n]] = 1;
            }
            // grab interfaces and types for those devices, and put in the cumulative list of the parent and all grand-parents, etc.
            log_dbg("***************** 1 getHierarchy ");
            get_aux_data(keyz,get_paths(locationpath));
            log_dbg("***************** 2 getHierarchy ");
        };

        grab_resources(hierarchy.resources);
        if(hierarchy.children) {
            stack.push({leaves: hierarchy.children, parent: null});
            while(stack.length > 0) {
                var tree = stack.pop();
                var keyz = Object.keys(tree.leaves);
                for (var n = 0; n < keyz.length; n++) {
                    if (tree.leaves[keyz[n]].children) {
                        var pushit = {leaves: tree.leaves[keyz[n]].children};
                        if(tree.parent) {
                            pushit.parent = tree.parent + '/' + keyz[n];
                        } else {
                            pushit.parent = keyz[n];
                        }
                        log_dbg("walk @",pushit.parent,"keyz[n]=",keyz[n],tree.leaves[keyz[n]]);
                        graph.allLocationPaths[pushit.parent] = {};
                        graph.allLocationPaths[pushit.parent].children = Object.keys(pushit.leaves); //tree.leaves[keyz[n]].children;
                        var devnames = Object.keys(tree.leaves[keyz[n]].resources);
                        graph.allLocationPaths[pushit.parent].resources = devnames;                  // the resources at this location
                        graph.allLocationPaths[pushit.parent].allResources = {};                     // a cumulative list (as a map) of all resource at 
                        // var q = devnames.length;                                                  // ... this location and below
                        // while(q--) {
                        //     graph.allLocationPaths[pushit.parent].allResources[devnames[q]] = 1;
                        // }
                        graph.allLocationPaths[pushit.parent].childInterfaces = {}; // a list of all interfaces below 'pushit.parent'
                        graph.allLocationPaths[pushit.parent].childTypes = {};      // a list of all types (of devices) below 'pushit.parent'
                        stack.push(pushit);
                    }
                    if (tree.leaves[keyz[n]].resources) {
                        grab_resources(tree.leaves[keyz[n]].resources,pushit.parent);
                    }
                }
            }
        }

        return Promise.all(aux_proms);
    };

    var updateGraph = function() {
        return new Promise(function(resolve,reject) {
            _self.getResourceTree().then(function (res) {
                var out = {};
                out.hierarchy = res;
                var proms = [];
                proms.push(walkGraph(out));
                cache.set(CACHE_WALK_GRAPH_ALL, out, TTL);

                var placedDevices = Object.keys(out.allDevices);
                cache.set(CACHE_PLACED_DEVICE_LIST, placedDevices, TTL);

                var ky = 'select("id=*").listResources()';
                var ret = cache.get(ky);
                if (!ret) {
                    proms.push(
                        _uncachedGetAllResources().then(function (r) {
                            if (r) {
                                ret = _.difference(r.keyz, placedDevices);
                                cache.set(CACHE_UNPLACED_DEVICE_LIST, ret);
    //                            resolve();
                            } else {
                                log_err("API failure - no result from listResources()");
//                                reject("API failure");
                            }
                        })
//                         .catch(function (e) {
//                             log.error("API Error",e);
// //                            reject("API Error", e);
//                         })
                        );
                    Promise.all(proms).then(function(){
                        resolve();
                    }).catch(function(e){
                        log_err("API Error",e);
                        reject("API Error" + e);
                    });
                } else {
                    var alldevices = Object.keys(ret);
                    ret = _.difference(alldevices, placedDevices);
                    cache.set(CACHE_UNPLACED_DEVICE_LIST, ret);
                    Promise.all(proms).then(function(){
                        resolve();
                    }).catch(function(e){
                        log_err("API Error",e);
                        reject("API Error" + e);
                    })
                }
            }, function (err) {
                log_err("updateGraph - API failure:", e);
                reject(err);
            });
        });
    };

    /**
     * given an array of device IDs, this will show only device IDs which have an interface for their
     * type which match a given regex
     * @method  filterDeviceListByInterfaceRegex
     * @param  {Array} deviceids List of device IDs
     * @param  {RegExp} interfacefilter A RegExp for filtering
     * @return {Promse} A Promise which fulfills with an array which is a subset of the device ID array 
     * that have a matching interface for the given filter
     * @example
     * ```
     *    dev$UtilsDEBUG.filterDeviceListByInterfaceRegex(['0017880a7876-1','LIFXd073d502b6ef','TunnelMonitor'],/Facades/)
     * ```   
     * might return a Promise which fulfills with:
     * ```
     *       {
     *          devices: ["LIFXd073d502b6ef","0017880a7876-1"],
     *          interfaces: ["Facades/hasWhiteTemp","Facades/Colorable","Facades/Switchable","Facades/Dimmable"]
     *       }
     * ```
     */
    this.filterDeviceListByInterfaceRegex = function(deviceids,interfacefilter) {
        var ret = {
            devices: {},
            interfaces: {}
        };

        var deviceMatch = function(id,filter){
            return new Promise(function(resolve,reject){
                                    log_dbg(" ** 3");
                _self.listInterfacesOfDevices(id).then(function(ifs){
                    var z = ifs.length;
                    while(z--) {
                        if(filter.test(ifs[z])) {
                            log_dbg(" ** 3 push ret",ifs[z]);
                            ret.devices[id] = 1;
                            ret.interfaces[ifs[z]] = 1;
                        }
                    }
                    resolve();
                }).catch(function(e){ // no matter what, resolve
                    log_err("filterDeviceListByInterfaceRegex: @catch",e);    
                    resolve();
                });
            });
        }

        if(!Array.isArray(deviceids) || !(interfacefilter instanceof RegExp)) {
            return Promise.reject("utils.filterDeviceListByInterfaceRegex bad parameters");
        }
        log_dbg(" ** 1");
        var proms = [];
        var n = deviceids.length;
        while(n--) {
                    log_dbg(" ** 2");
            proms.push(deviceMatch(deviceids[n],interfacefilter));
        }
        return Promise.all(proms).then(function(){
            ret.devices = Object.keys(ret.devices);
            ret.interfaces = Object.keys(ret.interfaces);
            return Promise.resolve(ret);
        });
    }

    /**
     * A utility to get the device heirarchy already flattened and parsed.
     * Provides the device hierarchy in three ways in an object which resolves as a complex object.
     * @method  getHierarchy
     * @example
     * ```
     * dev$UtilsDEBUG.getHierarchy().then(function(v){
     *    console.log(JSON.stringify(v));
     * });
     * ```
     * might return
     * ```
     * {
     *    "hierarchy":{
     *       "children":{
     *          "Dining Area":{
     *             "children":{
     *                "Subloc1":{
     *                   "children":{
     * 
     *                   },
     *                   "resources":{
     *                      "WWFL000010":{
     * 
     *                      }
     *                   }
     *                }
     *             },
     *             "resources":{
     *                "WWFL00000Z":{
     * 
     *                }
     *             }
     *          },
     *          "Upstairs":{
     *             "children":{
     * 
     *             },
     *             "resources":{
     *                "WWFL000010":{
     * 
     *                },
     *                "WWFL000016":{
     * 
     *                }
     *             }
     *          }
     *       },
     *       "resources":{
     * 
     *       }
     *    },
     *    "allDevices":{
     *       "WWFL00000Z":{
     *          "location":"Dining Area"
     *       },
     *       "WWFL000010":{
     *          "location":"Dining Area/Subloc1"
     *       },
     *       "WWFL000016":{
     *          "location":"Upstairs"
     *       }
     *    },
     *    "allLocationPaths":{
     *       "Dining Area":{
     *          "children":[
     *             "Subloc1"
     *          ],
     *          "resources":[
     *             "WWFL00000Z"
     *          ],
     *          "allResources":{     // all resources under this location & its sublocations
     *             "WWFL00000Z":1,
     *             "WWFL000010":1
     *          },
     *          "childInterfaces":{  // all interfaces under this location & its children
     *             Core/Interfaces/Unpairable: 1,
     *             Facades/Colorable: 1,
     *             Facades/Dimmable: 1,
     *             Facades/Switchable: 1,
     *             Facades/hasWhiteTemp: 1
     *          },
     *          "childTypes":{
     *             "Core/Devices/Lighting/WigwagDevices/Filament":1
     *          }
     *       },
     *       "Upstairs":{
     *          "children":[
     * 
     *          ],
     *          "resources":[
     *             "WWFL000010",
     *             "WWFL000016"
     *          ],
     *          "allResources":{
     *             "WWFL000010":1,
     *             "WWFL000016":1
     *          },
     *          "childInterfaces":{
     *             Core/Interfaces/Unpairable: 1,
     *             Facades/Colorable: 1,
     *             Facades/Dimmable: 1,
     *             Facades/Switchable: 1,
     *             Facades/hasWhiteTemp: 1
     *          },
     *          "childTypes":{
     *             "Core/Devices/Lighting/WigwagDevices/Filament":1
     *          }
     *       },
     *       "Dining Area/Subloc1":{
     *          "children":[
     * 
     *          ],
     *          "resources":[
     *             "WWFL000010"
     *          ],
     *          "allResources":{
     *             "WWFL000010":1
     *          },
     *          "childInterfaces":{
     *             Core/Interfaces/Unpairable: 1,
     *             Facades/Colorable: 1,
     *             Facades/Dimmable: 1,
     *             Facades/Switchable: 1,
     *             Facades/hasWhiteTemp: 1
     *          },
     *          "childTypes":{
     *             "Core/Devices/Lighting/WigwagDevices/Filament":1
     *          }
     *       }
     *    }
     * }
     * ```
     * @return {Promise} resolves with said object
     */
    this.getHierarchy = function() {
        return new Promise(function(resolve,reject) {
            var ret = cache.get(CACHE_WALK_GRAPH_ALL);
            if(ret) {
                resolve(ret);
            } else {
                updateGraph().then(function(){
                    ret = cache.get(CACHE_WALK_GRAPH_ALL);
                    resolve(ret);
                }).catch(function(e){
                    log_err("devjsUtils internal error:",e);
                    reject(e);
                });
            }
        });
    };


    /**
     * Return a Promise which fulfills with a list of devices which are not in any resource groups.
     * @method  listUnplacedDevices
     * @return {Promise} Promise which fulfills with above object
     */
    this.listUnplacedDevices = function() {
        return new Promise(function(resolve,reject) {
            var ret = cache.get(CACHE_UNPLACED_DEVICE_LIST);
            if(ret) {
                resolve(ret);
            } else {
                updateGraph().then(function(){
                    ret = cache.get(CACHE_UNPLACED_DEVICE_LIST);
                    resolve(ret);
                }).catch(function(e){
                    log_err("devjsUtils internal error:",e);
                    reject(e);
                });
            }
        });
    };

    /**
     * Return a Promise which fulfills with a list of devices which are in at least one resource group.
     * @method  listPlacedDevices
     * @return {Promise} Promise which fulfills with above object
     */
    this.listPlacedDevices = function() {
        var self = this;
        return new Promise(function(resolve,reject) {
            var ret = cache.get(CACHE_PLACED_DEVICE_LIST);
            if(ret) {
                resolve(ret);
            } else {
                updateGraph().then(function () {
                    var ret = cache.get(CACHE_PLACED_DEVICE_LIST);
                    resolve(ret);
                }, function (err) {
                    log_err("listPlacedDevices - API failure:", e);
                    reject(err);
                });
            }
        });
    };

    /**
     * Returns an Array of all device names. This will used cache if available.
     * @method  listAllDevices
     * @return {Promise} Promise which fulfills with above object
     */
    this.listAllDevices = function() {
        var self = this;
        return new Promise(function(resolve,reject) {
            var ret = cache.get(CACHE_DEVICE_LIST);
            if(ret) {
                resolve(ret);
            } else {
                _uncachedGetAllResources().then(function(r){
                    resolve(r.keyz);
                }).catch(function(e){
                    reject(e);
                });
            }
        });
    };

    /**
     * Build a list of the format 
     * ``` 
     *    [{ 'IDabc' : { 
     *         registered: true, 
     *         reachable: false, 
     *         [ other data... ] 
     *    }, 'IDxyz' : { 
     *        registered: ...
     *        ...
     *    }, 
     *    ... more devices
     *    ]
     * ```
     * from a given list of device IDs. If a device ID is not known by deviceJS it is reported `null`
     * @method  listDeviceStatus
     * @param {Array|device ID} list List of device IDs to provide status, as an `Array` of `String`
     * @return {Promise} which will resolve to the given list
     */
    this.listDeviceStatus = function(list) {
        if(!Array.isArray(list)) {
            list = [list];
        }
        var stats = {};
        var prom = [];
        var get_one = function(id){
            var ky = cacheKeyDeviceListResources(id);
            var ret = cache.get(ky);
            if(ret) {
                if(typeof ret[id] == 'object') {
                    var kyz = Object.keys(ret[id]);
                    var n = kyz.length;
                    stats[id] = {};
                    while(n--) {
                        stats[id][kyz[n]] = ret[id][kyz[n]];
                    }
                }
                else
                    stats[id] = null;
            } else {
                prom.push(devJS.select('id="'+id+'"').listResources().then(function(r){
                    cache.set(ky,r,TTL);
                    log_dbg('actual lookup id=',id,r);
                    if(typeof r[id] == 'object') {
                        var kyz = Object.keys(r[id]);
                        var n = kyz.length;
                        stats[id] = {};
                        while(n--) {
                            stats[id][kyz[n]] = r[id][kyz[n]];
                        }
                    } else
                        stats[id] = null;
                }));
            }
        };
        return new Promise(function(resolve,reject){
            for(var n=0;n<list.length;n++) {
                get_one(list[n]);
            }
            return Promise.all(prom).then(function(){
                resolve(stats);
            }).catch(function(e){
                reject(e);
            })
        });
    };

    var return_excluded_keys = function(master,list) {
        var ret = [];
        var master_keyz = Object.keys(master);
        for(var n=0;n<master_keyz.length;n++) {
            if(list[master_keyz[n]] === undefined) {
                ret.push(master_keyz[n]);
            }
        }
        return ret;
    };

    /**
     * returns a list of devices which are accounted for by deviceJS but are not in the given
     * Array of device IDs. The collection should be keyed by resource ID.
     * @method  listExcludedResourceIDs
     * @param {Array} list of device IDs
     * @return {Promise} resolves to an Array of device IDs not in 'list'
     */
    this.listExcludedResourceIDs = function(list) {
        return new Promise(function(resolve,reject) {
            var ky = 'select("id=*").listResources()';
            var ret = cache.get(ky);
            if (ret === undefined) {
                devJS.select("id=*").listResources().then(function (r) {
                    cache.set(ky,r,TTL*3); // give it a bigger TTL, this rarely changes
                    resolve(return_excluded_keys(r,list));
                }).catch(function(e){
                    reject(e);
                });
            } else {
                resolve(return_excluded_keys(ret,list));
            }
        });
    };

    /**
     * list all interface types
     * @method  listInterfaceTypes
     * @return {Promise} a Promise which fulfills with state value 
     */
    this.listInterfaceTypes = function() {
        return new Promise(function(resolve,reject) {
            var ky = "listInterfaceTypes()";
            var ret = cache.get(ky);
            if (!ret) {
                devJS.listInterfaceTypes().then(function (r) {
                    cache.set(ky, r, TTL * 3); // give it a bigger TTL, this rarely changes
                    resolve(r);
                }).catch(function(e){
                    reject(e);
                });
            } else {
                resolve(ret);
            }
        });
    };

    var setCache_multiSelect_to_singleSelect_listResources = function(res) {
        var devs = Object.keys(res);
        for(var n=0;n<devs.length;n++) {
            var store = {};
            store[devs[n]] = res[devs[n]]; // store format is just like returned from deviceJS: { DEVICE_ID : { data } }
            var k = cacheKeyDeviceListResources(devs[n]);
            log_dbg("cache <-",k,store);
            cache.set(k,store,TTL); // store the listResources() of that device
        }

        return devs.length;
    };


    /**
     * Get a list of types from a list of devices
     * @method  listTypesOfDevices
     * @param {Array|string} id A string or Array of device IDs
     * @return {Promise} which fulfills with an Array of 'Resource Types' the device(s) belongs to. The list is in no particular order.
     */
    this.listTypesOfDevices = function(id) {
        var list = id;
        if(!Array.isArray(id)) {
            list = [id];
        }
        if(list === undefined || list.length < 1) {
            return Promise.resolve([]);
        }
        return new Promise(function(resolve,reject){
            var type_list = {};
            var query_str = '';
            var not_cached = [];
            for(var n=0;n<list.length;n++) {
                var res = cache.get(cacheKeyDeviceListResources(list[n]));
                if(!res) {
                    not_cached.push(list[n]);
                    if(query_str.length > 0)
                        query_str += ' or ';
                    query_str += 'id="'+list[n]+'"';
                } else {
                    var devs = Object.keys(res);  // this is just like it came from dev$:
                    // { LIFXd073d5116ab0:
                    //   { type: 'Core/Devices/Lighting/LIFX/White900BR30',
                    //     registered: true,
                    //     reachable: true } }
                    for(var p=0;p<devs.length;p++) {
                        type_list[res[devs[p]].type] = 1;
                    }
                }
            }

            if(not_cached.length > 0) {
                devJS.select(query_str).listResources().then(function(r){
                    log_dbg("Cache miss: dev$.select("+query_str+").listResources()");
                    for(var n=0;n<not_cached.length;n++) {
                        if(r[not_cached[n]]) {
                            type_list[r[not_cached[n]].type] = 1;
                        } else {
                            log_dbg("listTypesOfDevices() Oops. Resource",not_cached[n], "not found.");
                        }
                    }
                    setCache_multiSelect_to_singleSelect_listResources(r);
                    ret = Object.keys(type_list);
                    resolve(ret);
                }).catch(function(e){
                    log_err("devJSUtil: listTypesOfDevices Got an error",e);
                    reject(e);
                });
            } else {
                ret = Object.keys(type_list);
                resolve(ret);
            }
        });

    };


    var extract_interfaces = function(type_list,query_list) {
        var ret = {};
        log_dbg("extract_interfaces:");//,arguments);
        /*
         dev$.listResourceTypes().then(function(r){console.dir(r['Core/Devices/Lighting/WebSim/ColorableBulb']['0.0.1'].interfaces);});
         [ 'Facades/Dimmable',
         'Facades/Switchable',
         'Facades/Colorable',
         'Facades/hasWhiteTemp',
         'Core/Interfaces/hasDeviceLabel' ]
         */
        for (var n = 0; n < query_list.length; n++) {
            //log_dbg("looking at:",query_list[n]);
            if(type_list[query_list[n]]) {
                var type_def = type_list[query_list[n]];
                //log_dbg("type def: ", type_def);
                var first_version = Object.keys(type_def)[0]; // TODO this maybe an issue if there are multiple version of a interface
                for(var p=0;p<type_def[first_version].interfaces.length;p++) {
                    //log_dbg("found interface:",type_def[first_version].interfaces[p]);
                    ret[type_def[first_version].interfaces[p]] = 1;
                }
            }
        }
        log_dbg("Done:",ret);
        return Object.keys(ret);
    };


    /**
     * Lists all resource types know about by deviceJS
     * @method listResourceTypes
     * @return {Promise} which will resolve to the given list
     */
    this.listResourceTypes = function() {
        return new Promise(function(resolve,reject) {
            var ky = "listResourceTypes()";
            var ret = cache.get(ky);

            if(!ret) {
                devJS.listResourceTypes().then(function(r){
                    log_dbg("cache miss: listResourceTypes()",r);
                    cache.set(ky,r,TTL*3); // give it a bigger TTL, this rarely changes
                    var ky2 = "listResourceTypes()";
                    var ret2 = cache.get(ky2);
                    if(!ret2) {
                        throw "Ouch. Weird Weird.";
                    }
                    resolve(r);
                }).catch(function(e){
                    reject(e);
                });
            } else {
                log_dbg("+++++ used CACHE.");
                resolve(ret);
            }
        });
    }

    /**
     * Get a list of interfaces from a list of resource types.
     * @method  listInterfacesOfTypes
     * @param {Array|string} id A string or Array of device IDs
     * @return {Promise} which fulfills with an Array of 'Interfaces' the 'Resource Type(s)' implement. The list is in no particular order.
     */
    this.listInterfacesOfTypes = function(id) {
        var list = id;
        if(!Array.isArray(id)) {
            list = [id];
            log_dbg("listInterfacesOfTypes = not array");
        }
        if(list === undefined || list.length < 1) {
            return Promise.resolve([]);
        }
        return new Promise(function(resolve,reject) {
            var ky = "listResourceTypes()";
            var ret = cache.get(ky);

            if(!ret) {
                devJS.listResourceTypes().then(function(r){
                    log_dbg("cache miss: listResourceTypes()");
                    cache.set(ky,r,TTL*3); // give it a bigger TTL, this rarely changes
                    var ky2 = "listResourceTypes()";
                    var ret2 = cache.get(ky2);
                    if(!ret2) {
                        throw "Ouch. Weird Weird.";
                    }
                    ret = extract_interfaces(r,list);
                    resolve(ret);
                }).catch(function(e){
                    reject(e);
                });
            } else {
                log_dbg("+++++ used CACHE.");
                ret = extract_interfaces(ret,list);
                resolve(ret);
            }
        });
    };


    /**
     * Get a list of interfaces a device implements
     * @method  listInterfacesOfDevices
     * @param {Array|string} id A string or Array of device IDs
     * @return {Promise} which fulfills with an Array of Interfaces the device(s) implement. The list is in no particular order.
     */
    this.listInterfacesOfDevices = function(id) {
        var list = id;
        var self = this;
        if(!Array.isArray(id)) {
            list = [id];
        }
        if(list.length < 1) {
            return Promise.resolve([]);
        }
        if(id === undefined) {
            return new Promise(function(resolve,reject){
                var ky = 'select("id=*").listResources()';
                var ret = cache.get(ky);
                if(ret === undefined) {
                    devJS.select("id=*").listResources().then(function(r){
                        cache.set(ky,r,TTL*3); // give it a bigger TTL, this rarely changes
                        var ids = Object.keys(r);
                        return self.listTypesOfDevices(ids).then(function(r2){
                            log_dbg("*********** listTypesOfDevices=",r2);
                            self.listInterfacesOfTypes(r2).then(function(r3){
                                log_dbg("*********** 1 listInterfacesOfTypes=",r3);
                                resolve(r3);
                            });
                        });
                    }).catch(function(e){
                        reject(e);
                    });
                } else {
                    var ids = Object.keys(ret);
                    return self.listTypesOfDevices(ids).then(function(r2) {
                        log_dbg("*********** [cache] listTypesOfDevices=",r2);
                        self.listInterfacesOfTypes(r2).then(function (r3) {
                            log_dbg("*********** 2 listInterfacesOfTypes=",r3);
                            resolve(r3);
                        });
                    });
                }
            });
        } else {
            return new Promise(function(resolve,reject) {
                return self.listTypesOfDevices(list).then(function(r2){
                    log_dbg("************* [list] listTypesOfDevices=",r2);
                    self.listInterfacesOfTypes(r2).then(function(r3){
                        log_dbg("*********** 3 listInterfacesOfTypes=",r3);
                        resolve(r3);
                    });
                }).catch(function(e){
                    reject(e);
                })
            });
        }
    };


    /**
     * NOT IMPLEMENTED
     * This uses dev$.forgetResource() to remove resources which are:
     * - not in a location
     * - not registered (and not reachable)
     * These are usually devices deviceJS saw, but were never onboarded by a UI, and are now 
     * no longer existant.
     * @return {Promise} Fullfils on completion. Always fulfills unless deviceJS is down.
     */
    this.pruneUnplacedUnregisteredDevices = function() {
        // TODO
    }


    var getPathComponents = function(s){
        return s.split("/");
    };


    /**
     * Moves a device from one resource group to another by stated paths. Places the device in the given resource group
     * then removes the device from the other resouece group.
     * @method  moveDevice
     * @param  {String} id       The device ID of the resource
     * @param  {String} frompath The String path where the device should 'moved' from.
     * @param  {String} topath   The String path where the device should 'moved' to.
     * @return {Promise}          A Promise which fulfills when the entire operation is complete
     */
    this.moveDevice = function(id,frompath,topath) {
        return devJS.joinResourceGroup(id,topath).then(function(){
            return devJS.leaveResourceGroup(id,frompath);
        });
    };

    /**
     * This works just like the 'mv' command in Unix. A new resource group is created, if it does not already exist. All devices are joined to
     * this resource group, then devices are removed form the old resource group, then the empty resource group is removed. 'sub resource groups'
     * or 'folders' (if looking at it using the file system metaphor) are supported, and the function will recursively handle them.
     * @method  moveResourceGroup
     * @param {String} from a path
     * @param {String} to new path
     * @param {Object} [graph]  Optional. results from dev$.getResourceGroup('') If not provided this will be pulled from
     * cache in devJSUtils
     * @return {Promise} which fulfills when the move is complete.
     */
    this.moveResourceGroup = function(from,to,graph){
        var graph = null;
        var prefix = null; // used if the group already exists, and we need to move into that group

        var verifySource = function(){
            var src_path = getPathComponents(from);
            var walk = graph;
            var l = 0;
            while(l < src_path.length) {
                if(walk.children && walk.children[src_path[l]]) {
                    walk = walk.children[src_path[l]];
                    l++;
                } else {
                    break;
                }
            }
            return (l == src_path.length);
        };

        var getGraph = function(){
            if(graph) {
                if(verifySource())
                    return Promise.resolve();
                else
                    return Promise.reject('from path non-existant');
            } else {
                return new Promise(function(resolve,reject) {
                    _self.getResourceTree().then(function (r) {
                        graph = r;
                        if (verifySource())
                            return resolve();
                        else
                            return reject('from path non-existant');
                    });
                });
            }
        };


        var createNewLocation = function(p){
            return new Promise(function(resolve,reject){
                var _path = to;
                var walk = graph;
                var walk_locs = getPathComponents(to);
                var l = 0;
                while(l < walk_locs.length) {
                    if(walk.children && walk.children[walk_locs[l]]) {
                        walk = walk.children[walk_locs[l]];
                        l++;
                    } else {
                        break;
                    }
                }

                if(l >= walk_locs.length) {
                    var src_path = getPathComponents(from);
                    prefix = src_path[src_path.length-1];
                    log_dbg("moveResourceGroup: its a copy 'into'",prefix);
                    _path = path.join(to,prefix);
                }

                devJS.createResourceGroup(_path).then(function(r){
                    if(r.ok) {
                        log_dbg("created location",_path);
                        resolve();
                    } else {
                        reject('no ok');
                    }
                },function(e){
                    log_err("Failed to create resource group:",to,e);
                    reject(e);
                })

            });
        };

        var moveDevices = function(){
            return new Promise(function(resolve,reject){
                var proms = [];
                var work = {};

                var base_path = to;

                var walk = graph;
                var walk_locs = getPathComponents(from);
                var l = 0;
                while(l < walk_locs.length) {
                    if(walk.children && walk.children[walk_locs[l]]) {
                        walk = walk.children[walk_locs[l]];
                        l++;
                    } else {
                        break;
                    }
                }

                if(l < walk_locs.length) {
                    reject('from path non-existant');
                    return;
                }

                var top = walk;

                var process_leaf = function(basepath,walk) {
//                    log.debug("top process_leaf",walk);
                    if(walk && walk.children) {
                        var childnames = Object.keys(walk.children);
                        for(var z=0;z<childnames.length;z++) {
                            var _path = path.join(basepath,childnames[z]);
                            var _work = {
                                path: _path,
                                resources: walk.children[childnames[z]].resources
                            };
                            work[_path] = _work;

                            (function(_path){
                                var newpath = _path;
                                log_dbg("createResourceGroup()",newpath);
                                // NOTE: joinResourceGroup() will actually create the resource group
                                // if it does not already exist yet. So we don't have to chain these
                                // sequentially
                                proms.push(devJS.createResourceGroup(newpath));
                                if(work[_path].resources) {
                                    var resource_names = Object.keys(work[_path].resources);
                                    for(var q=0;q<resource_names.length;q++) {
                                        log_dbg("joinResourceGroup()",resource_names[q],_path);
                                        proms.push(devJS.joinResourceGroup(resource_names[q],newpath))
                                    }
                                }
                            })(_path);


                            process_leaf(_path,walk.children[childnames[z]]);
                        }
                    }
                };

                if(prefix) {
                    base_path = path.join(base_path,prefix);
                }

                process_leaf(base_path,top);

                Promise.all(proms).then(function(){
                    // remove old resource group - will recursively delete them all
                    devJS.deleteResourceGroup(from).then(function(){
                        log_dbg("Removed old resource group (success):",from);
                        resolve();
                    },function(e){
                        log_err("Removed old resource group:",e);
                        reject('delete-failed');
                    }).catch(function(e){
                        log_err("@catch Removed old resource group:",e);
                        reject('delete-failed');
                    })
                },function(e){
                    log_err("Failure during createAndMove",e)
                }).catch(function(e){
                    log_err("@catch during createAndMove",e)
                });
            });
        };

        return getGraph()
            .then(createNewLocation)
            .then(moveDevices);
    }

    // Alias commands
    // 
    
    var DDB_ALIAS_PREFIX = "devjsUtils.alias.";
    var DDB_ALIAS_BYID_PREFIX = "devjsUtils.aliasById.";

    var DEFAULT_ALIAS_CACHE_TIMEOUT = 30000; // 30 seconds

    var cached_id_to_alias = new Cache();
    var cached_alias_to_id = new Cache();      

    var lookupAliasByIdDDB = function(devid) {
        var cached = cached_id_to_alias.get(devid);
        if(cached) {
            console.log("CACHE HIT")
            return Promise.resolve(cached);
        } else
            return ddb.shared.get(DDB_ALIAS_BYID_PREFIX+devid).then(function(val){
                if(val && typeof val == 'object') {
                    if(val.siblings && val.siblings.length < 1)
                        return null; // no data
                    var alias = (val.value) ? val.value : val.siblings[0];
                    cached_alias_to_id.set(alias,devid,DEFAULT_ALIAS_CACHE_TIMEOUT);
                    cached_id_to_alias.set(devid,alias,DEFAULT_ALIAS_CACHE_TIMEOUT);                
                    return devid;
                } else {
                    return null;
                }
            });
    }


    var lookupIdByAliasDDB = function(alias) {
        var cached = cached_alias_to_id.get(alias);
        if(cached) {
            return Promise.resolve(cached);
        } else {
            return ddb.shared.get(DDB_ALIAS_PREFIX+alias).then(function(val){
                console.log("after get")
                if(val && typeof val == 'object') {
                    if(val.siblings && val.siblings.length < 1)
                        return null; // no data
                    var devid = (val.value) ? val.value : val.siblings[0];
                    cached_alias_to_id.set(alias,devid,DEFAULT_ALIAS_CACHE_TIMEOUT);
                    cached_id_to_alias.set(devid,alias,DEFAULT_ALIAS_CACHE_TIMEOUT);                
                    return devid;
                } else {
                    return null;
                }
            });            
        }
    }

    var setAliasDDB = function(devid,alias) {
        var context = undefined;
        var inner_setAliasDDB = function() {
            var proms = [];

            proms.push(ddb.shared.put(DDB_ALIAS_PREFIX+alias,devid)); // set in both maps
            proms.push(ddb.shared.put(DDB_ALIAS_BYID_PREFIX+devid,alias));
            return Promise.all(proms).then(function(){
                // now place in cache maps                
                cached_alias_to_id.set(alias,devid,DEFAULT_ALIAS_CACHE_TIMEOUT);
                cached_id_to_alias.set(devid,alias,DEFAULT_ALIAS_CACHE_TIMEOUT);                
            },function(err){
                throw new Error("devjsUtils: setAliasDDB failed on ddb.shared.put()" + util.inspect(err));
            });

            //     });
            // },function(err){
            //     throw new Error("devjsUtils: setAliasDDB failed on ddb.shared.put()" + util.inspect(err));
            // })            
        }

        return ddb.shared.get(DDB_ALIAS_PREFIX+alias).then(function(val){
            var proms = [];
            if(val == null) {
                return inner_setAliasDDB();
            } else {
                // if already was there, we need to remove cross-references
                // invalidate alias
                context = val.context;
                cached_alias_to_id.del(alias);
                for(var n=0;n<val.siblings.length;n++) {
                    // invalidate each ID
                    cached_id_to_alias.del(val.siblings[n]);
                    // and remove ddb entry
                    proms.push(ddb.shared.delete(DDB_ALIAS_PREFIX+val.siblings[n],context)); // delete the entry in the reverse map
                }
                return Promise.all(proms).then(inner_setAliasDDB);
            }
        });
    }

    /**
     * Sets or gets a device alias. If a 'newname' is provided, the method will 
     * set the alias name for a specific device ID. Device IDs may only have one alias
     * using this routine.
     * @method deviceAlias
     * @param  {[type]} devid   [description]
     * @param  {[type]} newname [description]
     * @return {[type]}         [description]
     */
    this.deviceAlias = function(devid,newname) {
        if(ddb) {
            // set alias name
            if(newname) {
                if(typeof newname == 'string') {
                    return setAliasDDB(devid,newname);
                } else {
                    throw new Error("devJSUtils: Invalid Parameter");
                }
            } else {
            // get alias name 
                return lookupAliasByIdDDB(devid)
            }
        } else {
            throw "No ddb selector provided.";
        }   
    }

    /**
     * Returns a device ID given an alias
     * @method  getIdByAlias
     * @param  {[type]} alias [description]
     * @return {[type]}       [description]
     */
    this.getIdByAlias = function(alias) {
        return lookupIdByAliasDDB(alias)
    }

    /**
     * Use with caution folks. Erases all alias data.
     * @method removeAllAliases
     * @return {[type]} [description]
     */
    this.removeAllAliases = function() {
        var proms = [];
        var next = function(err,result) {
            // if(err) {
            //     console.error("Error on next()",err);
            // } else
            // console.log("result:",result);
            if(!err) {
                proms.push(ddb.shared.delete(result.key,result.context));
//                proms.push(ddb.shared.delete(result.key));
            }
        }

        proms.push(ddb.shared.getMatches(DDB_ALIAS_PREFIX,next))
        proms.push(ddb.shared.getMatches(DDB_ALIAS_BYID_PREFIX,next))
        return Promise.all(proms).then(function(){
            cached_alias_to_id.clear();
            cached_id_to_alias.clear();
            console.log("CLEARED")
        });
    }


    /**
     * This returns all aliases / device ID pairs, which match a particular pattern
     * of an alias. That pattern is represented as a regex. If a function is provided,
     * then that function is called every time a match is found. 
     * @method findAllAliases
     * @param  {Regex} regex Regex to match against
     * @param  {function} func  options function to call on each match
     * @return {Promise}       A Promise which fulfills with an object that is a map
     * of all matches. Each key is an alias, each value is the device ID. If no matches
     * are found, an empty object is returned.
     * @example
     * ```
     *    utils.deviceAlias('RUNNER','internal_1')
     *    utils.deviceAlias('Rules','internal_2')
     *
     *    // then, after above calls complete (they asynchronous and return promises)
     *    
     *    var foundsome = function(alias,id){
     *        console.log("Alias found:",alias,id);
     *    }
     *    utils.findAllAliases(/internal_.*$/,foundsome).then(function(map){
     *        console.log("map:",map);
     *        var aliases = Object.keys(map);
     *        assert(aliases.length, CHEESE_NUMS);
     *    })
     * ```
     * Output
     * ```
     *    Alias found: internal_1 RUNNER
     *    Alias found: internal_2 Rules
     *    maps: { RUNNER: 'internal_1'
     *        Rules: 'internal_2'
     *    }
     * ```
     * 
     */
    this.findAllAliases = function(regex, func) {
        var proms = [];
        var map = {};

        if(!regex || typeof regex.exec != 'function') {
            throw new TypeError("a Regex is required as first param.");
        }

        var next = function(err,result) {
            if(!err) {
                var alias = result.key.split(result.prefix);
                var m = regex.exec(alias[1]);
                if(m && m.length > 0) {
                    if(typeof func == 'function') {
                        var ctx = { match: m }
                        func.call(ctx,alias[1],result.siblings[0]);
                    }
                    map[result.siblings[0]] = alias[1];
                }
            }
        }


        proms.push(ddb.shared.getMatches(DDB_ALIAS_PREFIX,next));

        return Promise.all(proms).then(function(){
            return map;
        });

    }

    /**
     * This returns the equivalent of using dev$.selectByID(id), if selecting
     * one or more devices, but by alias instead.
     * @method selectByAlias
     * @param {Regex|String} regex A regex or a string
     * @return {Promise} returns a Promise which fulfills with the selection, which would be the same as the 
     * result of a call to dev$('id=XYZ') if the parameter passed used an alias which mapped to device ID 'XYZ'.
     * @example
     * ```
     *    utils.deviceAlias('RUNNER','internal_1')
     *    utils.deviceAlias('Rules','internal_2')
     *    //
     *    // then later (bear in mind deviceAlias commands don't finish until their
     *    // Promise fulfills) ...
     *    //
     *    utils.selectByAlias(/internal.*$/).then(function(sel){
     *       sel.listResources().then(function(res){
     *           console.log("Select by regex:",res);
     *           assert('object',typeof res.RUNNER)
     *           assert('object',typeof res.Rules)
     *       });
     *    })
     * ```
     */
    this.selectByAlias = function(regex){
        if(devJS) {
            var sel_str = "";
            if(typeof regex == 'string') {
                var s = lookupIdByAliasDDB(regex);
                return s.then(function(devid){
                    console.log("HEY",devid)
                    if(devid) {
                        var sel_str = 'id="'+devid+'"';
                        log_dbg("selectByAlias() - selection str:",sel_str)
                        return devJS.select(sel_str);
                    } else {
                        return devJS.select(); // just return empty selection
                    }

                })
            } else {
                return this.findAllAliases(regex).then(function(map){
                    var keys = Object.keys(map);
                    if(keys.length > 0) {
                        sel_str = 'id="'+keys[0]+'" '
                        for(var n=1;n<keys.length;n++) {
                            sel_str += 'or id="'+keys[n]+'" '
                        }
                    }
                    log_dbg("selectByAlias() - selection str:",sel_str)
                    return devJS.select(sel_str);
                });
            }
        } else {
            throw new Error("No dev$ selector assigned.")
        }
    }

};

module.exports = {
    // instance: function(devJS,opts) {
    //     return new devJSUtils(devJS,opts);
    // }
    instance: function(one,two,three) {
        return new devJSUtils(one,two,three);
    }
};
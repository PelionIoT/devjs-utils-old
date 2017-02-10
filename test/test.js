var util = require('util');
var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;

if(!ddb || !dev$) {
	console.error("Run this using devicejs run");
	process.exit(1);
}

console.log("Test alias functions...");

var tests = 0;
var assertions = 0;
var failures = 0;

var testit = function(description,testfunc) {
	var THIS = {}
	console.log("Test["+tests+"] started");
	testfunc.call(THIS);
	tests++;
}

var totalProms = [];

var closeAssertion = function(description) {
	assertions--;
	var s = "[OK] "
	if(description) s+= description;
	console.log(s);
	if(assertions == 0) {
		console.log("Assertions complete1")	
	}
}
var closeAssertionFailure = function(err,description) {
	failures++;
	assertions--;
	var s = "[FAIL] "
	if(description) s+= description;
	console.error(s);
	console.error("Error:",err)
	if(assertions == 0) {
		console.log("Assertions complete!")	
	}
//	throw s;
}

var assertPromise = function(thenable,assertfunc,description){
	assertions++;
	totalProms.push(
	thenable.then(function(r){
		var THIS = {}
		if(assertfunc)
			assertfunc.apply(THIS,arguments);
		closeAssertion(description);
	},function(err){
		var s = "Failure at assertPromise. Was reject. Args:" + util.inspect(arguments);
		if(err && err.stack) s += " --> "+err.stack;
		closeAssertionFailure(s,description);

	}).catch(function(err){
		var s= "assertPromise @catch: " +util.inspect(err);
		if(err && err.stack) s += " --> "+err.stack;
		console.error(s);
		closeAssertionFailure("Failed",description)
	})
	)
}

var assertPromiseReject = function(thenable,assertfunc){
	assertions++;
	totalProms.push(
	thenable.then(function(r){
		var s = "Failure at assertPromise. Was resolved (should be reject). Args:" + util.inspect(arguments);
		if(err && err.stack) s += " --> "+err.stack;
		closeAssertionFailure(s,description);
	},function(){
		var THIS = {}
		if(assertfunc)
			assertfunc.apply(THIS,arguments);
		closeAssertion(description);
	}).catch(function(err){
		var s= "assertPromiseReject @catch: " +util.inspect(err);
		if(err && err.stack) s += " --> "+err.stack;
		console.error(s);
		closeAssertionFailure("Failed",description)
	})
	)
}

var DDB_ALIAS_PREFIX = "devjsUtils.alias.";
var DDB_ALIAS_BYID_PREFIX = "devjsUtils.aliasById.";

var CHEESE_NUMS=20

testit("test deviceAlias() set/lookup",function(){

    var dumpNext = function(err,result) {
    	if(err) {
    		console.error("Error on next()",err);
    	} else
    	console.log("next:",result);
	}

	var _utils = require('../devjsUtils.js');
	var utils = _utils.instance(dev$,ddb,{ debug_mode: true });

	utils.deviceAlias('dev2','harry2').then(function(){
		assertPromise(utils.getIdByAlias('harry2'),(r)=>{
	//		throw "shit"
			assert.equal(r,'dev2');
		},'check getIdByAlias()');

		assertPromise(utils.deviceAlias('dev2'),(r)=>{
			assert(r,'harry2')
		},'check deviceAlias()')




	}).then(function(){

		ddb.shared.getMatches(DDB_ALIAS_PREFIX,dumpNext).then(function(){
			return ddb.shared.getMatches(DDB_ALIAS_BYID_PREFIX,dumpNext);
		}).then(function(){
			console.log("ok - now remove all aliases");
			return utils.removeAllAliases();
		}).then(function(){
			console.log("ok - cache cleared");
		}).then(function(){
			return ddb.shared.getMatches(DDB_ALIAS_BYID_PREFIX,dumpNext);
		}).then(function(){
			assertPromise(utils.getIdByAlias('harry2'),(r)=>{
		//		throw "shit"
				assert.equal(r,null);
			},'check getIdByAlias() for null');

			assertPromise(utils.deviceAlias('dev2'),(r)=>{
				console.log("r is",r);
				assert.equal(r,null)
			},'check deviceAlias() for null');

		}).then(function(){

			var proms = [];
			for(var n=0;n<CHEESE_NUMS;n++) {
				proms.push(utils.deviceAlias('testdevice'+(n+100),'cheese'+n))
			}
			return Promise.all(proms);
		}).then(function(){
			var foundsome = function(alias,id){
				console.log("Alias found:",alias,id);
			}
			utils.findAllAliases(/cheese*/,foundsome).then(function(map){
				console.log("map:",map);
				var aliases = Object.keys(map);
				assert(aliases.length, CHEESE_NUMS);
			})
		}).then(function(){
			console.log("ok - cache cleared");
		}).then(function(){
			return ddb.shared.getMatches(DDB_ALIAS_BYID_PREFIX,dumpNext);			
		}).then(function(){
			console.log("Test selectByAlias()")
			var proms = [];
			// test with some 'internal' devices which are always in deviceJS
			proms.push(utils.deviceAlias('RUNNER','internal_1'));
			proms.push(utils.deviceAlias('Rules','internal_2'));
			assertPromise(
			Promise.all(proms).then(function(){
				return utils.selectByAlias(/internal.*$/).then(function(sel){
					assertPromise(sel.listResources().then(function(res){
						console.log("Select by regex:",res);
						assert('object',typeof res.RUNNER)
						assert('object',typeof res.Rules)
					}) );
				});
			})
			)
			
		})

	})



	// assert.equal(,'dev1');
	// assert.equal(utils.deviceAlias('dev1'),'harry');


});


//process.exit(0);
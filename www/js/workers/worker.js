//リモートCoucDBのURLとして、利用する。
//var couchurl = window.location.origin;

importScripts("/_suggest/js/pouchdb-5.2.1.min.js");
var keywords = null;
var remote_keywords = null;

var sentences = null;
var remote_sentences = null;

var similar_keywords = null;
var remote_similar_keywords = null;

var couchurl = null;
self.addEventListener("connect", function(e) {  
   var port = e.ports[0];  
   

   port.addEventListener("message", function(e) {  

	   	if(e.data[0] == 'initialize' ){

			couchurl = e.data[1]; //window.location.origin　はWorkerから取得できないため、
	   		if(remote_keywords == null){
	   			remote_keywords = new PouchDB(couchurl+"/keywords");
	   			
	   			keywords = new PouchDB("keywords");
	
				keywords.replicate.from(remote_keywords,{
					live: true, retry: true
				});
				port.postMessage("Done keywords");
	   		}
	   		if(remote_sentences == null){
	   			remote_sentences = new PouchDB(couchurl+"/sentences");
	   			
	   			sentences = new PouchDB("sentences");
				sentences.replicate.from(remote_sentences,{
					live: true, retry: true
				});
				port.postMessage("Done sentences");
	   		}

	   		if(remote_similar_keywords == null){
	   			remote_similar_keywords = new PouchDB(couchurl+"/similar_keywords");
	   			
	   			similar_keywords = new PouchDB("similar_keywords");
				similar_keywords.replicate.from(remote_similar_keywords,{
					live: true, retry: true
				});
				port.postMessage("Done similar_keywords");

	   		}


	   			   		
	   	}


   }, false); 
   //  
   port.start();  
}, false);


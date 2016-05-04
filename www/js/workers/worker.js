//リモートCoucDBのURLとして、利用する。
//var couchurl = window.location.origin;
importScripts("/_suggest/js/pouchdb-5.2.1.min.js");

// PouchDB ローカルとリモートのインスタンスなど
var keywords = null;
var remote_keywords = null;

var sentences = null;
var remote_sentences = null;

var similar_keywords = null;
var remote_similar_keywords = null;

// CouchDBがインストールされているURL
var couchurl = null;

// DBがダウンロードされたかどうか確認するため
var keywords_completed = false;
var similar_keywords_completed = false;
var sentences_completed = false;

// Errorがあるかどうか
var hasError = false;

// DBのダウロードが完了されたかどうか確認するため関数
// 一旦 complete になると、ずっと true を返すしくみ
function isDataloaded(){
	var completed = similar_keywords_completed && keywords_completed && sentences_completed;
	return completed;
	
}
self.addEventListener("connect", function(e) {  
   var port = e.ports[0];  
   

   port.addEventListener("message", function(e) { 

	   	if(e.data[0] == 'initialize' ){
	   		
			port.postMessage(isDataloaded());
			couchurl = e.data[1]; //window.location.origin　はWorkerから取得できないため、
	   		if(remote_keywords == null){
	   			remote_keywords = new PouchDB(couchurl+"/keywords");
	   			
	   			keywords = new PouchDB("keywords");
	   			port.postMessage(isDataloaded());
	
				keywords.replicate.from(remote_keywords,{
					live: true, retry: true
				}).on('paused', function (err) {
				  keywords_completed = true;
				  hasError = false;
				  port.postMessage(isDataloaded());
				}).on('complete', function (info) {
				  keywords_completed = true;
				  hasError = false;
				  port.postMessage(isDataloaded());
				}).on('error', function (err) {
	
				  hasError = true;
				});

	   		}
	   		if(remote_sentences == null){
	   			remote_sentences = new PouchDB(couchurl+"/sentences");
	   			
	   			sentences = new PouchDB("sentences");
				sentences.replicate.from(remote_sentences,{
					live: true, retry: true
				}).on('paused', function (err) {
				  sentences_completed = true;
				  hasError = false;
				  port.postMessage(isDataloaded());
				}).on('complete', function (info) {
				  sentences_completed = true;
				  hasError = false;
				  port.postMessage(isDataloaded());
				}).on('error', function (err) {
				  hasError = true;
				});

	   		}

	   		if(remote_similar_keywords == null){
	   			remote_similar_keywords = new PouchDB(couchurl+"/similar_keywords");
	   			
	   			similar_keywords = new PouchDB("similar_keywords");
				similar_keywords.replicate.from(remote_similar_keywords,{
					live: true, retry: true
				}).on('paused', function (err) {
				  similar_keywords_completed = true;
				  hasError = false;
				  port.postMessage(isDataloaded());
				}).on('complete', function (info) {
				  similar_keywords_completed = true;
				  hasError = false;
				  port.postMessage(isDataloaded());
				}).on('error', function (err) {
				  hasError = true;
				});

		

	   		}

	   			   		
	   	}


   }, false); 
   //  
   port.start();  
}, false);


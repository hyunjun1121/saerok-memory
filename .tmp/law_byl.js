/* 
 * summary : 별표관련 js
 * history
 *          2017.06.20. 최초 이관
 *          2019.06.12. [#15806] 별표 비교 관련 개선요청 -> 팝업창 위치변경, 팝업창 로드시 기본으로 비교화면 제공하도록 변경처리
 *			2019. 06. 18. [#15883] 별표검색 오류 -> 검색어 변경 및 탭 변경 시 페이지 값 처리
 *			2019. 08. 29. [#16490] 별표서식 본문 새창으로 선택 시 화면 오류 개선
 *			2020. 11. 19. [#21421] 국가법령 메뉴 링크 개선
 *			2021. 08. 26. [#25310] 조회이력, 내가 찾은 법령에 학칙규정, 별표서식도 추가되도록 기능 개선
 *			2023. 06. 08. [#32789] 강원특별자치도 명칭 변경에 따른 LSW 수정(자치법규 외)
 *			2023. 06. 30. [#32892] 하드코딩된 교육청 코드 소스들을 캐시로 수정
 *			2023. 10. 17. [#33584] 별표 서식 sort 필터 추가 요청
 *			2024. 06. 27. [#34713] 문서뷰어를 통한 미리보기 기능 개발(행정규칙, 자치법규)
*/
var bylIdx = 0;
var bylCnt = 3;
var bylSearchUrl = new Array("lsBylScListR.do","admRulBylScListR.do","ordinBylScListR.do");

var BylValueObj = function(){				// 법령정보 Obj
	this.lsValue 	= {lsiSeq : "",
					lsId : "",
					lsNm: "",
					ancYd: "",
					ancNo: "",
					efYd: "",
					efYn: "",
					chrClsCd: "",
					paras : "",
					nwYn: "",
					joNo : "",
					joBrNo : "",
					docCls : "",
					joChgYn : "",
					csq : "",
					popLsiSeq : "",
					nwLsIncRvs : "",
					vSct : "",
					efDvPop : "",
					ancDvPop : "",
					nwJoYnInfo : "",
					efGubun : "",
					lsRvsGubun : "",
					joBdyYn : ""
					};		
	this.conValue = {joListDpYn : false,		// ls 컨트롤 Obj 
					popUpYn : "",
					hLsiSeq : "",
					hEfYd : "",
					preChkId : "",
					listDiv : "",
					bdyMode: true,
					bdyLangType : "",
					updateMode : "",
					srchUrl : ""};
					
	this.updateValue = {actionUrl : "",
						updateDiv : "",
						updateMode : "",
						updateListMode : ""
						};
	this.bdyUpdValue = {actionUrl : "",
						updateDiv : "",
						updateMode : "",
						updateContentNm : ""
						};
	this.LangType = "";		
	this.bdyType = "";	
	this.csmShowHideCls = true;;
	this.comparePrevNo = -1;	
	this.lsJoHstPara = "";	
	this.msg = "본문 조회 후 사용하세요.";
	this.openPopValue = {lsiSeq : "",			// 새창으로 정보 obj
						 lsEfYn : false,		// 시행예정 팝업 여부
						 lsEfSeq : "",
						 lsJoEfYdSeq : "",
						 lsJoRltDpYn : "", 		//  조문내용 조회 시 본문 url
						 popMode : "",
						 popCls : ""	
						};
}

BylValueObj.prototype.remove = function(){	// 법령정보 초기화 
	this.lsValue.lsiSeq = "";
	this.lsValue.lsNm = "";
	this.lsValue.chrClsCd = "";
	this.lsValue.paras = "";
	this.lsValue.joNo = "";
	this.lsValue.joBrNo = "";
	this.lsValue.lsId = "";
	this.lsValue.ancYd = "";
	this.lsValue.ancNo = "";
	this.lsValue.efYd = "";
	this.lsValue.efYn = "";
	this.lsValue.joChgYn = "";
	this.bdyType = "";
	this.csmShowHideCls = true;
	this.lsValue.popLsiSeq = "";
	this.lsValue.nwLsIncRvs = "";
	this.lsValue.efDvPop = "";
	this.lsValue.ancDvPop = "";
	this.lsValue.nwJoYnInfo = "";
	this.lsValue.efGubun = "";
	this.lsValue.lsRvsGubun = "";
	this.lsValue.joBdyYn = "";
}	


BylValueObj.prototype.removeConValue = function(){	// 법령정보 초기화 
	 this.conValue.preChkId = "";
}

var BylSearchObj = function(){
	this.param = {q: "",
				  outmax: "50", 
				  p1 : "", 
				  p2 : "", 
				  p3 : "", 
				  p4 : "",
				  p5 : "",
				  p6 : "",
				  d1 : "", 
				  pg : "1", 
				  dsort : "", 
				  fsort:"", 
				  csq:"",
				  section : "bylNm",
				  areaOrgCd : "",
				  orgOrdinAreaCd : "",
				  tabType : "1",
				  totCnt : ""};
}

BylSearchObj.prototype.remove = function(){
	this.param.q = "";
	this.param.outmax = "50"; 
	this.param.p1 = ""; 
	this.param.p2 = ""; 
	this.param.p3 = ""; 
	this.param.p4 = ""; 	
	this.param.p5 = ""; 
	this.param.p6 = "";
	this.param.d1 = ""; 
	this.param.pg = "1"; 
	this.param.dsort = ""; 
	this.param.fsort = ""; 
	this.param.csq = "";
	this.areaOrgCd = "";
	this.orgOrdinAreaCd = "";
	this.param.totCnt = "";
}

/* 법령, 행정규칙, 자치법규 설정 */
function bylIdxSet(idx){
	bylIdx = idx;
}

/* 검색어 체크 */
function QueryValDationCheck(){
	if(el('query').value.trim().length <=1 || el('query').value == searchMessage[searchId]){
		alert("검색어는 두자이상 입력해야 합니다.");
		el('query').value = "";
		el('query').focus();
		return false;
	}
	
}

//해당하는(법령, 행정규칙, 자치법규) 검색 Radio 버튼 레이어 숨김 / 보임 
function bylRadioSet(){
	var bylRadioId;
	for(i=0; i<bylCnt; i++){
		bylRadioId = "bylRadio_" + i;
		if(i != bylIdx){
			setDisplay(bylRadioId,"none");
		}else{
			setDisplay(bylRadioId,"block");
		}
	}
}

function syncBylFilter(objId, objVal){
	
	$("#"+objId+" > option").attr("selected", false);
	$("#"+objId+" > option[value='"+objVal+"']").attr("selected", true);
}


//별표.서식 선택 필터 
function filterByl(no){
	if(no == "0") no = "";
	bylSearchObj.param.p1 = no;
	bylSearchObj.param.pg = 1;
	syncBylFilter('bylCls',no);
	fSearch();
}

// 가나다 필터 
function fSort(no){
	if(bylIdx == 0){		//법령
		if(bylSearchObj.param.tabType == '2') bylSearchObj.param.p3 = no;
		else bylSearchObj.param.p2 = no;
	}else if(bylIdx == 1){	//행정규칙
		if(bylSearchObj.param.tabType == '2') bylSearchObj.param.p4 = no;
		else bylSearchObj.param.p2 = no;
	}else if(bylIdx == 2){	//자치법규
		if(bylSearchObj.param.tabType == '2') bylSearchObj.param.p6 = no;
		else bylSearchObj.param.p2 = no;
	}
	//bylSearchObj.param.p2 = no;
	fSearch();
}

// 볍령 소관부처 필터 
function filterLsOrg(no){
	if(no == "0") no = "";
	bylSearchObj.param.csq = no;
	bylSearchObj.param.pg = 1;
	syncBylFilter('orgCd',no);
	fSearch();
}

// 행정규칙 소관부처 필터 
function filterAdmOrg(no){
	if(no == "0") no = "";
	bylSearchObj.param.p3 = no;
	bylSearchObj.param.pg = 1;
	syncBylFilter('orgCd',no);
	fSearch();
}
//자치법규 지역 필터 검색 
function filterOrdinArea(no){
	/*
	if(no == "0" || no == ""){ 
	 	no = "";
	 	bylSearchObj.param.p3 = no;
	 	return;
	}	
	bylSearchObj.param.p3 = no;			//시군구
	bylSearchObj.param.areaOrgCd = el("ordinAreaCd").value;
	*/
	fSearch();
}

//자치법규 지역 필터 검색 - 웹접근성용 
function filterOrdinAreaWeb(no){
	
	if(no == "0" || no == ""){ 
	 	no = "";
	 	bylSearchObj.param.p3 = no;
		if($('#ordinAreaCd').val() == '0') {
			alert("시도를 먼저 선택해주세요.");
			return;
		}
	} else {
		bylSearchObj.param.p3 = no;
	}

	bylSearchObj.param.pg = 1;
	bylSearchObj.param.areaOrgCd = el("ordinAreaCd").value;
	
	if($('#ordinAreaCd').length > 0){
		syncBylFilter('ordinAreaCd',$('#ordinAreaCd').val());		
	}
	syncBylFilter('orgAreaCd',no);
	fSearch();
}

//웹접근성용
function fSearchWeb(){
	//if(QueryValDationCheck() == false) return;
	
	el("query").value = specChar(el("query").value);
	
	SearchQryParamSet();
	
	if(bylIdx == '2'){
		//fUpdateBylCall("bylListDiv",bylSearchUrl[bylIdx],bylSearchObj.param,ordinAreaSet);
		fUpdateBylCall("listDiv",bylSearchUrl[bylIdx]+"?"+linkUrl,bylSearchObj.param,ordinAreaSetWeb);
	}else{
		//updateDiv("bylListDiv",bylSearchUrl[bylIdx],bylSearchObj.param);
		fUpdateByl("listDiv",bylSearchUrl[bylIdx]+"?"+linkUrl,bylSearchObj.param);
	}
	
	//setSchKeywordCookie();
	//changeAutocomState(AFTER_SEARCH);	
}


/* 지역코드(-시군구-) select 박스  */ 
function fAreaList(no,val){
	var keyCd = no;
	
	if(keyCd!="" && keyCd !='0'){
		//procObj = areaList;
		procObj = function () { areaList(val) };
		doRequestUsingPOST('AreaListR.do?keyCd='+keyCd);
	}else{
		document.getElementById("AreaListR").innerHTML = "<select name=\"orgAreaCd\" id=\"orgAreaCd\" style=\"width:auto;\" class=\"btnfont\"><option value=\"\" selected>시군구</option></select>";
	}
}

/* 지역코드(-시군구-) select 박스   :: 웹접근성용*/ 
function fAreaListWeb(obj, chgYn) {

	var chgYn = chgYn;
	var keyCd = obj.value;
	if (keyCd) {
		//procObj = areaList;
		procObj = function () { areaListWeb(obj) };
		doRequestUsingPOST('AreaListR.do?keyCd='+keyCd);
	}else{
		document.getElementById("AreaListR").innerHTML = "<select name=\"orgAreaCd\" id=\"orgAreaCd\" style=\"width:auto;\" class=\"btnfont\"><option value=\"\" selected>시군구</option></select>";
	}

	if(chgYn == 'Y'){
		if(keyCd == '0') {
			alert("시도를 선택해주세요.");
			return;
		} else {
			filterOrdinAreaWeb();
		}
	} else {
		document.getElementById("AreaListR").innerHTML = "<select name=\"orgAreaCd\" id=\"orgAreaCd\" style=\"width:auto;\" class=\"btnfont\"><option value=\"\" selected>시군구</option></select>";
	}
}

/** 지역 select 설정  callback 함수- Web접근성용 */
function ordinAreaSetWeb(){
	if(el('ordinAreaHcd1') != null && el('ordinAreaHcd2') != null){
		var areaCd1 = el('ordinAreaHcd1').value;
		var areaCd2 = el('ordinAreaHcd2').value;
		if(areaCd1 != "" && areaCd2 != ""){
			 fAreaListWeb(areaCd1,areaCd2);
		}
	}
}

function areaList(val){
	
	var xmlDoc = xmlHttp.responseXML;
	
   	var allStates = xmlDoc.getElementsByTagName("row");
    var currentState = null;
    var cd = "";
    var cdNm = "";
    var divHtml = "";
    
    for(var i = 0; i < allStates.length; i++) {
       currentState = allStates[i];
        orgCd = currentState.getElementsByTagName("orgCd")[0].childNodes[0].nodeValue;
 		orgNm =  currentState.getElementsByTagName("orgNm")[0].childNodes[0].nodeValue;
 		if(i == 0)
 			divHtml += "<option value=\"0\" onchange=\"javascript:filterOrdinArea(this.value);\">시군구</option>";
 		if(val != "" && val == orgCd){
 			divHtml += "<option selected value=\""+orgCd+"\" >"+orgNm+"</option>";
 		}else{
    		divHtml += "<option value=\""+orgCd+"\" >"+orgNm+"</option>";
    	}
    	
    }
    if(allStates.length>0){
	   	document.getElementById("AreaListR").innerHTML = "<select name=\"orgAreaCd\" id=\"orgAreaCd\" class=\"btnfont\" onchange=\"javascript:filterOrdinArea(this.value);\" style=\"width:120px\">" +divHtml+"</select>";
	}else{
		document.getElementById("AreaListR").innerHTML = "<select name=\"orgAreaCd\" id=\"orgAreaCd\" style=\"width:120px\" class=\"btnfont\"><option value=\"\" selected>시군구</option></select>";
	}
	
}
// 웹접근성용  areaListWeb
function areaListWeb(obj) {
	
	var xmlDoc = xmlHttp.responseXML;
	
   	var allStates = xmlDoc.getElementsByTagName("row");
    var currentState = null;
    var cd = "";
    var cdNm = "";
    var divHtml = "";
    
    for(var i = 0; i < allStates.length; i++) {
    	
       currentState = allStates[i];
        orgCd = currentState.getElementsByTagName("orgCd")[0].childNodes[0].nodeValue;
 		orgNm =  currentState.getElementsByTagName("orgNm")[0].childNodes[0].nodeValue;
 		if(i == 0)
 			divHtml += "<option selected value=\"0\">시군구</option>";

 		if(orgCd == $(obj).val()){
 			divHtml += "<option value=\""+orgCd+"\" >"+orgNm+"</option>";
 		}else{
    		divHtml += "<option value=\""+orgCd+"\" >"+orgNm+"</option>";
    	}
    	
    }
    
    var filterIndex = $(obj).find('option:selected').index();
    $(obj).attr('selected', false);
    $(obj).find('option:eq(' + filterIndex + ')').attr('selected', true);
    
    if(allStates.length>0){
	   	document.getElementById("AreaListR").innerHTML = "<select name=\"orgAreaCd\" id=\"orgAreaCd\" style=\"width:auto;\" class=\"btnfont\">" +divHtml+"</select>";
	}else{
		document.getElementById("AreaListR").innerHTML = "<select name=\"orgAreaCd\" id=\"orgAreaCd\" style=\"width:auto;\" class=\"btnfont\"><option value=\"\" selected>시군구</option></select>";
	}
	
}

// 페이지 이동 //
function movePage(pg){	
	bylSearchObj.param.pg = pg;
	fSearch();
}

//법령정보 상세 조회 
function lsOpenPop(seq){
	var popUrl = "lsInfoP.do?lsiSeq=" + seq;
	openPop(popUrl,1040,630);
}

function admOpenPop(seq, flag){
	var popUrl = "";
	if(flag == 1){		//대통령훈령, 국무총리훈령
		popUrl = "admRulLsInfoP.do?chrClsCd=010202&admRulSeq=" + seq;
	}else{				//일반소관부처 행정규칙 
		popUrl = "admRulInfoP.do?chrClsCd=010201&admRulSeq=" + seq;
	}
	openPop(popUrl);
}

function ordinOpenPop(seq){
	var popUrl = "ordinInfoP.do?ordinSeq=" + seq;
	openPop(popUrl,950,630);
}

/** 법령 별표 상세조회 PoP*/
function showDetailLsByl(bylSeq, lsiSeq){
	var popUrl = "";
	var vSct = bylSearchObj.param.q;
	popUrl="lsBylInfoPLinkR.do?bylSeq=" + bylSeq 
						+ "&lsiSeq=" + lsiSeq
						+ "&vSct=" + vSct;

	openPop(popUrl);
}
/** 행정규칙 별표 상세조회 PoP*/
function showDetailAdmByl(bylSeq, AdmRulSeq){
	var popUrl = "";
	var vSct = bylSearchObj.param.q;
	popUrl="admRulBylInfoPLinkR.do?bylSeq=" + bylSeq 
						+ "&admRulSeq=" + AdmRulSeq
						+ "&vSct=" + vSct;
	openPop(popUrl);
}
/** 행정규칙 별표 상세조회2 PoP*/
function showDetailAdmByl2(bylSeq, AdmRulSeq, admFlag, flSeq){
	var popUrl = "";
	var vSct = bylSearchObj.param.q;
	popUrl="admRulBylInfoPLinkR.do?bylSeq=" + bylSeq 
						+ "&admRulSeq=" + AdmRulSeq
						+ "&admFlag=" + admFlag
						+ "&flSeq=" + flSeq
						+ "&vSct=" + vSct;
	openPop(popUrl);
}
/** 자치법규 별표 상세조회 PoP*/
function showDetailOrdinByl(bylSeq,ordinSeq){
	var popUrl = "";
	var vSct = bylSearchObj.param.q;
	popUrl="ordinBylInfoPLinkR.do?bylSeq=" + bylSeq 
						+ "&ordinSeq=" + ordinSeq
						+ "&vSct=" + vSct;
	openPop(popUrl);
}
/** 자치법규 별표 상세조회 PoP*/
function showDetailOrdinByl2(bylSeq,ordinSeq,flSeq){
	var popUrl = "";
	var vSct = bylSearchObj.param.q;
	popUrl="ordinBylInfoPLinkR.do?bylSeq=" + bylSeq 
						+ "&ordinSeq=" + ordinSeq
						+ "&flSeq=" + flSeq
						+ "&vSct=" + vSct;
	openPop(popUrl);
}

/** 목록 인쇄 */
function listPrint(totCnt){
	var popUrl = "";
	
	var param = makeParam(bylSearchObj.param);
	var bylKindIdx = bylIdx; //0=법령, 1=행정규칙, 2=자치법규
	
	var listCnt = el('listCnt');
	if (listCnt == null || listCnt.innerHTML == 0){
		alert("저장할 검색 결과가 없습니다.");
		return false;
	}
	
	popUrl = "bylListPrint.do?" + param + "&bylKindIdx="+bylKindIdx;
	openPrintPop(popUrl,'');
}

//목록 저장
function listSave(obj,totCnt){		
	var form = el('saveForm');
	form.action = "bylListSave.do";
	var param = {bylKindIdx: ""};
	
	var listCnt = el('listCnt');
	if (listCnt == null || listCnt.innerHTML == 0){
		alert("저장할 검색 결과가 없습니다.");
		return false;
	}
	
	// 검색 전체 건수 저장 _ 20150528
	bylSearchObj.param.totCnt = listCnt.innerHTML.replace(/,/g, '');
	param.bylKindIdx = bylIdx;
	appendInputEls(form, "hidden", bylSearchObj.param);
	appendInputEls(form, "hidden", param);
	SaveWindow.showListSave(obj,0,0);
}

function fUpdateByl(divId, url, paramArray){
	layoutLoadMask(divId);
	$.ajax({
	   url: url,
	   data:		makeParam(paramArray),
	   success: function(responseText){
		   $('#'+divId).html(responseText);
		   layoutUnMask(divId);
	   },
	   error: function(e) {
		   layoutUnMask(divId);
	   }
	});	
}

function fUpdateBylCall(divId, url, paramArray,callback){
	$.ajax({
	   url: url,
	   data:		makeParam(paramArray),
	   success: function(responseText) {
		   $('#'+divId).html(responseText);
		   callback();
	   },
		error: function(e) {
		}
	});	
}

//** raido checkbox style **//
var _src,img_root='./images/button/btn_';
function makeformByl(){
	var ip=document.getElementsByTagName('input');
	//var _src,root='./images/button/btn_';
	for(var i=0,tmp,max=ip.length; i<max; i++){
		if(ip[i].type=='radio' || ip[i].type=='checkbox'){
			ip[i].relimg=document.createElement('img');
			ip[i]._src=(tmp=ip[i].className.match(/src_([a-z0-9_]+)/))? tmp[1]  : null;
			if(ip[i]._src) ip[i].relimg.src=img_root+ip[i]._src+((ip[i].checked)? 'on' : '')+'.gif';
			else ip[i].relimg.src=img_root+((ip[i].type=='radio')? 'rad' : 'che')+((ip[i].checked)? 'on' : '')+'.gif';
			ip[i].relimg.style.verticalAlign='middle';
			ip[i].style.display='none';
			ip[i].relimg.tg=ip[i];
			ip[i].relimg.onclick=function(){
				inputclickByl(this.tg);
				return false;
			}
			ip[i].parentNode.insertBefore(ip[i].relimg,ip[i]);
		}
	}
	var lb=document.getElementsByTagName('label');
	try{
		for(var i=0,max=lb.length; i<max; i++){
			if(lb[i].htmlFor){
				lb[i].tg=document.getElementById(lb[i].htmlFor);
				if(lb[i].tg.type=='radio' || lb[i].tg.type=='checkbox'){
					lb[i].onclick=function(){
						inputclickByl(lb[i].tg);
						return false;
					}
				}
			}
		}
	}catch(e){}
}

function inputclickByl(tg){
	tg.click();
	if(tg.type=='checkbox'){
		tg.relimg.src=img_root+((tg._src)? tg._src : 'che')+((tg.checked)? 'on' : '')+'.gif';
	}else if(tg.type=='radio'){
		var tmp = tg.name
		if(tmp.indexOf("BylR") > 0) SearchRadio(); //라디오 버튼 search
		var fd=eval('tg.form.' + tg.name);
		for(var i=0,max=fd.length; i<max; i++) fd[i].relimg.src=img_root+((tg.src)? tg.src : 'rad')+((fd[i].checked)? 'on' : '')+'.gif';
	}
}

function fSlimUpdate(divLayId,urlName,parameter){
	
	layoutLoadMask(divLayId);
	// 마스크 작업 후 화면 호출
	$("#"+divLayId).load(urlName, parameter,
			function(response, status, xhr) {
				layoutUnMask(divLayId);
			}
	);
	
}

function lawInfPop(bylseq, lsiseq, chkGubun){			// 새창으로 
	
	if(el("openPopYn").checked){
		if(chkGubun=='ls') showDetailLsByl(bylseq, lsiseq);
		if(chkGubun=='admRul') showDetailAdmByl(bylseq, lsiseq);
		if(chkGubun=='ordin') showDetailOrdinByl(bylseq, lsiseq);
		return true;
	}else{
		return false;
	}	
}

function openPopSet(obj, cnt) {
	/*
	 * if(cnt <= 0){ alert("조회할 목록이 없습니다."); obj.checked = false; return; }
	 */
	checkAllCheckbox(obj.checked, els("openYn"));
}

/*  
 * chkGubun : 법령, 행정규칙, 자치법규 구분값
 */
function bylViewAll(bylseq, lsiseq, checkId, chkGubun){	// 법령 상세 보기 
	// 새로 법령선택시
	setClass(checkId,"on");
	setDetailSelectBylCookie(chkGubun,bylseq);
	if(bylseq != bylVO.conValue.hLsiSeq){
		setClass(bylVO.conValue.preChkId,"");
		bylVO.remove();
		if(!lawInfPop(bylseq,lsiseq,chkGubun)){
			bylVO.conValue.preChkId = checkId;
			bylVO.conValue.hLsiSeq = bylseq;					// 동일 선택 위한 저장
			bylVO.lsValue.lsiSeq = bylseq;		
			bylVO.conValue.joListDpYn = true;
			bylVO.lsValue.chrClsCd = bylVO.LangType;			// 기본 언어 설정
			bdyChange(false);
			el("bodyContent").innerHTML = "";				// 초기화 
			lsBdyView(bylVO, bylseq, lsiseq, chkGubun);
		}
	}
	moveCheckLsNm(checkId);
}

function isWideOpenPop(){
	return el('openPopYn').checked;
}

/*
 * chkGubun : 법령, 행정규칙, 자치법규 구분값
 */
function bylViewWideAll(bylseq, lsiseq, checkId, chkGubun){	// 별표서식 목록화면에서 별표서식 상세조회
	// 새창이 아닐경우
	if(!isWideOpenPop()) {
		// wide -> list 본문 보여줄 때
		if (gIsWide == "wide") {
			gIsWide = "default";
			fnWestDefault();
			fnWestDivChange();
		}
	}
	bylViewAll(bylseq, lsiseq, checkId, chkGubun);
}

function bdyChange(mode){				// 
	logger.def("화면전환" + bylVO.conValue.bdyMode,1);
	if(!bylVO.conValue.bdyMode){
		setPopValue("lsBylInfoP");
		el("bodyContent").style.display = "";
		el("bodySideContent").style.display = "none";
		el("bodySideContent").innerHTML = "";
		bylVO.conValue.bdyMode = true;
	}
}

function moveCheckLsNm(checkId){
	window.location.href = "#" + checkId;
}

/**
 * <pre>
 * 	별표서식 본문 조회 (법령, 행정규칙, 자치법규)
 * 	history :
 * 				2018.05.28. 조회이력 기능 추가
 *                          기존에도 안되고 있어 구현만해놓고 주석처리
 * </pre>
 * @author brKim
 * @since 2018. 5. 28.
 * @param bylVO
 * @param bylseq
 * @param lsiseq
 * @param chkGubun
 */
function lsBdyView(bylVO, bylseq, lsiseq, chkGubun) {
	
	var urlVal = "lsBylInfoR.do";
	var gunun = 0;

	if (chkGubun == "admRul") {
		urlVal = "admRulBylInfoR.do";
	} else if (chkGubun == "ordin") {
		urlVal = "ordinBylInfoR.do";
	} 

	if (bylVO.lsValue.lsiSeq) {
		
		bylVO.bdyUpdValue.actionUrl = urlVal
		bylVO.bdyUpdValue.updateDiv = "bodyContent";
		bylVO.bdyUpdValue.updateMode = "lsBdy";

		if (chkGubun == "admRul") {
			gunun = 1;
			fAdmRulUpd(bylVO, bylseq, lsiseq);
		} else if (chkGubun == "ordin") {
			gunun = 2;
			fOrdinUpd(bylVO, bylseq, lsiseq);
		} else {
			fLsUpd(bylVO, bylseq, lsiseq);
		}
		
		// var setCookieValue = gunun + "," + bylVO.lsValue.lsiSeq;
		
		// setDetailSelectCookie('010108', setCookieValue);
	}
}

function fLsUpd(vo, bylseq, lsiseq){							// update
	var param = {"bylSeq" : bylseq, "lsiSeq" : lsiseq}; // 법표서식 자료실의 목록 시행을로 가지고 오면서 공포여부 Y 제외
	
	if(vo.conValue.bdyMode){					// 본문 조회용
		vo.conValue.bdyLangType = vo.lsValue.chrClsCd;
		fUpdate_Byl(vo.bdyUpdValue.updateDiv ,
				  vo.bdyUpdValue.actionUrl ,
				  makeParam(param), 
				  vo.bdyUpdValue.updateMode);
	}else{
		fLsUpdate(vo.updateValue.updateDiv ,	// sideContents
				  vo.updateValue.actionUrl ,
				  makeParam(vo.lsValue), 
				  vo.updateValue.updateMode);
	}
}

function fAdmRulUpd(vo, bylseq, admRulSeq){							// update
	var param = {"bylSeq" : bylseq, "admRulSeq" : admRulSeq};
	
	if(vo.conValue.bdyMode){					// 본문 조회용
		vo.conValue.bdyLangType = vo.lsValue.chrClsCd;
		fUpdate_Byl(vo.bdyUpdValue.updateDiv ,
				  vo.bdyUpdValue.actionUrl ,
				  makeParam(param), 
				  vo.bdyUpdValue.updateMode);
	}else{
		fLsUpdate(vo.updateValue.updateDiv ,	// sideContents
				  vo.updateValue.actionUrl ,
				  makeParam(vo.lsValue), 
				  vo.updateValue.updateMode);
	}
} 

function fOrdinUpd(vo, bylseq, ordinSeq){							// update
	var param = {"bylSeq" : bylseq, "ordinSeq" : ordinSeq};
	
	if(vo.conValue.bdyMode){					// 본문 조회용
		vo.conValue.bdyLangType = vo.lsValue.chrClsCd;
		fUpdate_Byl(vo.bdyUpdValue.updateDiv ,
				  vo.bdyUpdValue.actionUrl ,
				  makeParam(param), 
				  vo.bdyUpdValue.updateMode);
	}else{
		fLsUpdate(vo.updateValue.updateDiv ,	// sideContents
				  vo.updateValue.actionUrl ,
				  makeParam(vo.lsValue), 
				  vo.updateValue.updateMode);
	}
} 

/* 목록저장 submit 오버라이딩 별표서식만 
 * 1만건 까지 저장할 수 있게 하기 위함 */
function submitListSave(){
	
	alert('목록은 최대 10000까지 다운 받을 수 있고 최대 소요시간은 5분이상 걸릴 수 있습니다.');

	var form = el('saveForm');
	closeSetTime('SaveWindow.hideListSave()');
	
	form.submit();
}


function SearchQryParamSet(){
    if (el('query').value.trim() == "" || el('query').value.trim() == searchMessage[searchId]){
        bylSearchObj.param.q = "*";
    }else{
        bylSearchObj.param.q =  el('query').value.trim();
    }
    
    if(bylIdx == '2') ordinAreaParam();
}


function ordinAreaParam(){
    bylSearchObj.param.orgOrdinAreaCd = "";
    if(el('ordinAreaCd') != null && el('ordinAreaCd').value != "0")  { 
        bylSearchObj.param.p5 = el('ordinAreaCd').value;
        
        //시군구가 교육청일경우
        var tmpUpOrgCd =  $('#eduCdStr').val();
        var arr =tmpUpOrgCd.split(',');

        for(var i = 0; i < arr.length; i++){
            if(arr[i] == el('orgAreaCd').value){
                bylSearchObj.param.p5 = tmpUpOrgCd;
                bylSearchObj.param.orgOrdinAreaCd = el('ordinAreaCd').value;
            }
        }
    } else {
        bylSearchObj.param.p5 = "";
    }
        
    if(el('orgAreaCd') != null){
        if(el('orgAreaCd').value.trim() == "0" || el('orgAreaCd').value.trim() == "") bylSearchObj.param.p3 = "";
        else bylSearchObj.param.p3  = el('orgAreaCd').value.trim();
    }
}

// 검색 필터 동기화
function syncChkFilter() {
	$('.cont_wrap').html('<div class="list_util">' + $('.list_util').html() + '</div>');
	bodyInfo.divCenterInfo = $('.cont_wrap').html();
}

function fSearch(){
	 f_Search();
}

function f_Search(){
	
	syncChkFilter();
	
    el("query").value = specChar(el("query").value);

    bylVO.updateValue.updateMode = "list";
    bylVO.conValue.listDiv = "listDiv";
    
    if('bylNm' == bylSearchObj.param.section || 'bylBody' == bylSearchObj.param.section){
        bylVO.conValue.srchUrl = "lsBylScListR.do?"+linkUrl;
    }
    if('admBylNm' == bylSearchObj.param.section || 'admBody' == bylSearchObj.param.section){
        bylVO.conValue.srchUrl = "admRulBylScListR.do?"+linkUrl;
    }
    if('ordinBylNm' == bylSearchObj.param.section || 'ordinBody' == bylSearchObj.param.section){
        bylVO.conValue.srchUrl = "ordinBylScListR.do?"+linkUrl;
    }

    bylVO.removeConValue();
    
    bNwChk = false;

    SearchQryParamSet();

    fUpdate_Byl(bylVO.conValue.listDiv, bylVO.conValue.srchUrl, makeParam(bylSearchObj.param), bylVO.updateValue.updateMode);
    
    //자동완성, 내가찾은검색어
    //setSchKeywordCookie();
    //changeAutocomState(AFTER_SEARCH);  
    
    chkVal = false;
}

function fUpdate_Byl(divLayId, urlName, parameter, mode){
	
	// 목록 클릭 시 레이아웃 값 전달
	layoutLoadMask(divLayId);
	
	$.ajax({
		url: urlName,
		method: 'POST',
		data:makeParam(parameter),
		dataType:'text',
		success: function(responseText) {
			
			/* 리스트 동기화 부분 */
			if (divLayId !== 'bodyContent' && divLayId !== 'lsOutPutLayer') { // 리스트 동기화
				syncDivList(responseText);
			} else { // 본문 출력
				$('#'+divLayId).html(responseText);
			}
            
			if (mode == "wide" || mode == "default" || mode == "hide") {
			   try {
				   if (bylSearchObj.param.q) {
					   var searchText = "";
					   bylSearchObj.param.pg = "";
					   if ($("#direct3").val()) {
						   ordinSearchObj.param.q = $("#direct3").val();
					   }
				   }
			   } catch(e) {
				   logger.error(divLayId + "화면내검색에서 오류 ----->" + e ,1);
			   }
			}

			// 다이렉트 검색
            if(false){
                if(urlName == "lsBylScListR.do"){
                    bylViewAll(el("direct1").value, el("direct4").value, "liBgcolor" + el("direct2").value);
                    
                } else {
                    bylViewWideAll(el("direct1").value, el("direct4").value, "liBgcolor" + el("direct2").value);
                }
            }
            
            /*
             * 법령, 행정규칙, 자치법규 구분해줌
             * 2013.03.20 홍석균
             */
            
            if(urlName == "lsBylInfoR.do"){  // 법령
                var bylLsHstSeq = document.getElementById("bylList").value;
        		var temp = bylLsHstSeq.split(",");
        		var lsId = el("bylLsId").value;
        		
        		if(bylLsHstSeq == null || bylLsHstSeq == 'undefined' || bylLsHstSeq.length == 0) return false;
        
        		bylLsparam.lsiSeq=temp[0];
        		bylLsparam.bylNo=temp[1];
        		bylLsparam.bylBrNo=temp[2];
        		bylLsparam.bylClsCd=temp[3];
        		bylLsparam.lsId=lsId;
        		bylLsparam.bylSeq=temp[0];
        		bylLsparam.bylEfYd=temp[4];
        		bylLsparam.vSct = bylSearchObj.param.q;
        		fUpdateBylCall("bylListR","lsBylHstInfoR.do",bylLsparam, bylLsView);
                
            } else if(urlName == "admRulBylInfoR.do"){  // 행정규칙
                var bylHstSeq = document.getElementById("bylList").value;
        		var temp = bylHstSeq.split(",");
        		var admRulId = el("bylAdmRulId").value;
        		
        		if(bylHstSeq == null || bylHstSeq == 'undefined' || bylHstSeq.length == 0) return false;
        		
        		bylAdmRulparam.bylSeq=temp[0];
        		bylAdmRulparam.bylNo=temp[1];
        		bylAdmRulparam.bylBrNo=temp[2];
        		bylAdmRulparam.bylClsCd=temp[3];
        		bylAdmRulparam.admRulId=admRulId;
        		bylAdmRulparam.vSct = bylSearchObj.param.q;
        		fUpdateBylCall("bylListR","admRulBylHstInfoR.do",bylAdmRulparam, bylAdmRulView);
                
            } else if(urlName == "ordinBylInfoR.do"){  // 자치법규
                var bylHstSeq = document.getElementById("bylList").value;
        		var temp = bylHstSeq.split(",");
        		var ordinId = el("bylOrdinId").value;
        		var ordinSeq = el("bylOrdinSeq").value;
        		var gubun = el("gubun").value;
                
        		bylOrdinparam.bylSeq=temp[0];
        		bylOrdinparam.bylNo=temp[1];
        		bylOrdinparam.bylBrNo=temp[2];
        		bylOrdinparam.bylClsCd=temp[3];
        		bylOrdinparam.ordinId=ordinId;
        		bylOrdinparam.gubun = gubun;
        		bylOrdinparam.ordinSeq=ordinSeq;
        		bylOrdinparam.vSct = bylSearchObj.param.q;
        		fUpdateBylCall("bylListR","ordinBylHstInfoR.do",bylOrdinparam, bylOrdinView);
            } else if(urlName == "schlPubRulBylInfoR.do"){  // 학칙공단
                var bylHstSeq = document.getElementById("bylList").value;
        		var temp = bylHstSeq.split(",");
        		var schlPubRulId = el("bylSchlPubRulId").value;
        		
        		if(bylHstSeq == null || bylHstSeq == 'undefined' || bylHstSeq.length == 0) return false;
        		
        		bylSchlPubRulparam.bylSeq=temp[0];
        		bylSchlPubRulparam.bylNo=temp[1];
        		bylSchlPubRulparam.bylBrNo=temp[2];
        		bylSchlPubRulparam.bylClsCd=temp[3];
        		bylSchlPubRulparam.admRulId=schlPubRulId;
        		bylSchlPubRulparam.vSct = bylSearchObj.param.q;
        		fUpdateBylCall("bylListR","schlPubRulBylHstInfoR.do",bylSchlPubRulparam, bylSchlPubRulView);
                
            }
            layoutUnMask(divLayId);
       },
       error: function(e) {
    	   layoutUnMask(divLayId);	
       }
    });
}

/* 리스트 onmouseover시 배경 */
function onBgChgOver(obj){  
    obj.style.background = "#f2f6f9";
}
/* 리스트 onmouseout시 배경 */
function onBgChgOut(obj){
    obj.style.background = "#ffffff";
}

/**
 * 법령 인쇄
 */
function printlsByl(){
    openScrollPop(webRoot+"/bylInfoPrint.do");
}

function bylTextSaveNotIe(){
    var bylInfSeq = document.getElementById("bylList").value;
    var title = el('bylList').options[el('bylList').selectedIndex].text;
    title = (title.replace('<',"")).replace('>',"").split(',').join("").split('"').join("");
    
    // form 삭제
    var emptyForm = $("#bylFrm");
    emptyForm.empty();
    
    // form 동적 생성
    var frm = $("<form id=\"bylFrm\"></form>");
    frm.attr("action", $("#bylTextDownAction").val());
    frm.attr("method","post");
    frm.attr("target","_self");
    
    frm.appendTo('body');
    
    var bylSeq = $("<input type=\"hidden\" name =\"bylSeq\" value=\""+bylInfSeq.split(",")[0]+"\">");
    var title = $("<input type=\"hidden\" name =\"title\" value=\""+title+"\">");
    var mode = $("<input type=\"hidden\" name =\"mode\" value=\"0\">");
    
    frm.append(bylSeq);
    frm.append(title);
    frm.append(mode);
    
    frm.submit();
}

/**
 * 법령 별표 본문 조회
 */
//법령별표 본문조회
function bylLsView(){
	if(document.getElementById("HstLsByl") != null){
	    bylLsparam.bylSeq = document.getElementById("HstLsByl").value;
	    updateDiv("bylContents","lsBylContentsInfoR.do",bylLsparam,null,true);
	}
}

//행정규칙 별표 본문조회 
function bylAdmRulView(){
	if(document.getElementById("HstAdmRulByl") != null){
		bylAdmRulparam.bylSeq = document.getElementById("HstAdmRulByl").value;
		updateDiv("bylContents","admRulBylContentsInfoR.do",bylAdmRulparam,null,true);
	}
}

//학칙공단 별표 본문조회 
function bylSchlPubRulView(){
	if(document.getElementById("HstSchlPubRulByl") != null){
		bylSchlPubRulparam.bylSeq = document.getElementById("HstSchlPubRulByl").value;
		updateDiv("bylContents","schlPubRulBylContentsInfoR.do",bylSchlPubRulparam,null,true);
	}
}

//자치법규 별표 본문조회
function bylOrdinView(){
	
	// ELIS 데이터는 본문 조회를 하지 않는다. 이미지파일이 없다.
	if (document.getElementById("HstOrdinByl")) {
		bylOrdinparam.bylSeq = document.getElementById("HstOrdinByl").value;
	} else if (document.getElementById("hanFlSeq")) {
		// ELIS 사이냅뷰어 제공
		bylOrdinparam.bylFlSeq = document.getElementById("hanFlSeq").value;
		if(el("gubun")){
			bylOrdinparam.gubun = el("gubun").value;
		}
	}
	updateDiv("bylContents","ordinBylContentsInfoR.do",bylOrdinparam);
}

//뷰어 PDF 변환 스킨이 아닐경우 문구 추가
function viewLoad(bylFlSeq) {
	if ($("#fancybox-frame"+bylFlSeq)) {
		$("#fancybox-frame"+bylFlSeq).contents().find(".wrap__logo").css("display", "none");
		$("#fancybox-frame"+bylFlSeq).contents().find(".wrap__title").css("max-width", "45%");
		$("#fancybox-frame"+bylFlSeq).contents().find(".wrap__title").text("변환결과는 원본문서와 상이할 수 있습니다.");
	}
}

//한글 파일 다운로드
function setDownBtn(flExt){
	
	var flSeq = "";
	
	if(flExt == '1'){
        flSeq = $("#hanFlSeq").val();
    }else if(flExt == '2'){
        flSeq = $("#odtFlSeq").val();
    }else if(flExt == '3'){
        flSeq = $("#pdfFlSeq").val();
        if(flSeq==0){
        	alert('pdf 파일이 없습니다.');
        	return false;
        }
    }
	
	if(flSeq == 0 || flSeq == null || flSeq == 'undefined'){
	 	bylTextSaveNotIe();
	 	return false;
	}
	if(el("gubun") != null && el("gubun") != 'undefined'){
		var gubun = el("gubun").value;
		if(gubun == 'ELIS'){
			var flNm = el("bylTtl").value;
			
			location.href="flDownload.do?gubun=ELIS&flSeq=" + flSeq + "&flNm=" + +encodeURIComponent(flNm,"UTF-8");
			return false;
		}	
	}
	
	location.href = "flDownload.do?flSeq=" + flSeq;
}

function setListClass(obj){
    if(obj.id != bylVO.conValue.preChkId){
        obj.className = "";         
    }else{
        obj.className = "on";           
    }
}

function clickQuery() {
    if(clickQueryCnt!=0) {
        el("autom").style.display = el("autom").style.display == 'none' ? 'block':'none';
        el("autocomImg").src = el("autom").style.display == 'none' ? el("autocomImg").src.replace('upv6.gif','downv6.gif'):el("autocomImg").src.replace('downv6.gif','upv6.gif');
    }

    clickQueryCnt++;

    if(el("query").value == searchMessage[searchId]){
        el("query").value ="";  
        el("query").style.fontSize  = "13.3px";  
    }
}

//search 폼을 전체로 감싼 후 ff 에서 엔터 검색이 안되서 수동으로 keypress 이벤트 줌 2010 10 18 
function searchByKeyPress(event) {
    var keyCode = event.keyCode ? event.keyCode : event.which ? event.which : event.charCode;
    if (keyCode == 13) {
    	f_Search();
    }
}

/* 검색파라미터에 value 설정 */
function searchWParamSet(){
    searchParam.q = el('query').value.trim();
}


//--- 법령

var bylLsparam = {lsiSeq:"", bylNo:"", bylBrNo:"", bylClsCd:"", lsId :"", bylSeq:"", chrClsCd:"010202", vSct:"", directYn:"N"};
var chrClsCd = "";

// 연혁목록 생성
function fHstLsBylList(){

	var bylLsHstSeq = $("#bylList").val();
    var temp = bylLsHstSeq.split(",");
    var lsId = $("#bylLsId").val();
    var vSct = $("#vSct").val();
    var directYn = $("#directYn").val();
    if(bylLsHstSeq == null || bylLsHstSeq == 'undefined' || bylLsHstSeq.length == 0) return false;

    bylLsparam.lsiSeq = temp[0];
    bylLsparam.bylNo = temp[1];
    bylLsparam.bylBrNo = temp[2];
    bylLsparam.bylClsCd = temp[3];
    bylLsparam.lsId = lsId;
    bylLsparam.bylSeq = temp[0];
    bylLsparam.bylEfYd = temp[4];
    bylLsparam.vSct = vSct;
    bylLsparam.directYn = directYn;
    fUpdateBylCall("bylListR","lsBylHstInfoR.do",bylLsparam,bylLsView);
}

//관심 법령 등록
function interestLaw(){
    var pDivision = 'II';
    var pApplicationId = 1;
    var pListName = 'interest';
    var pTitle    = el("bylNm").value;
    var pLsId     = $("#lsiSeq").val();	//법령시퀀스
    var pAncNo    = '';
    var pLsiSeq   = $("#bylSeq").val();	//별표시퀀스들어가야됨
    var pEfYd     = bylLsparam.bylEfYd;
    var pKndClsCd = '010108';
    var pGourl = location.href;
    var pFolderName = "별표서식";

    interestLawSave(pDivision, pApplicationId, pListName, pTitle, pLsId, pAncNo, pLsiSeq, pEfYd, pKndClsCd, pGourl, pFolderName);
}


//--- 행정규칙

var bylAdmRulparam = { bylSeq:"", bylNo:"", bylBrNo:"", bylClsCd:"", admRulId :"", vSct:""};

//연혁목록 생성
function fHstAdmRulBylList(){

	var bylHstSeq = $("#bylList").val();
	var temp = bylHstSeq.split(",");
	var admRulId = el("bylAdmRulId").value;
	var vSct = $("#vSct").val();
	
	if(bylHstSeq == null || bylHstSeq == 'undefined' || bylHstSeq.length == 0) return false;
	
	bylAdmRulparam.bylSeq=temp[0];
	bylAdmRulparam.bylNo=temp[1];
	bylAdmRulparam.bylBrNo=temp[2];
	bylAdmRulparam.bylClsCd=temp[3];
	bylAdmRulparam.admRulId=admRulId;
 	bylAdmRulparam.vSct = vSct;
	fUpdateBylCall("bylListR","admRulBylHstInfoR.do",bylAdmRulparam,bylAdmRulView);
}

//--- 학칙공단
var bylSchlPubRulparam = { bylSeq:"", bylNo:"", bylBrNo:"", bylClsCd:"", schlPubRulId :"", vSct:""};
function fHstSchlPubRulBylList(){

	var bylHstSeq = $("#bylList").val();
	var temp = bylHstSeq.split(",");
	var schlPubRulId = el("bylSchlPubRulId").value;
	var vSct = $("#vSct").val();
	
	if(bylHstSeq == null || bylHstSeq == 'undefined' || bylHstSeq.length == 0) return false;
	
	bylSchlPubRulparam.bylSeq=temp[0];
	bylSchlPubRulparam.bylNo=temp[1];
	bylSchlPubRulparam.bylBrNo=temp[2];
	bylSchlPubRulparam.bylClsCd=temp[3];
	bylSchlPubRulparam.schlPubRulId=schlPubRulId;
	bylSchlPubRulparam.vSct = vSct;
	fUpdateBylCall("bylListR","schlPubRulBylHstInfoR.do",bylSchlPubRulparam,bylSchlPubRulView);
}

//-- 자치법규
var bylOrdinparam  = { bylSeq:"", bylNo:"", bylBrNo:"", bylClsCd:"", ordinId :"", gubun:"", vSct:"", bylFlSeq:""};

//연혁목록 생성
function fHstOrdinBylList(){
	
	var bylHstSeq = document.getElementById("bylList").value;
	var temp = bylHstSeq.split(",");
	var ordinId = el("bylOrdinId").value;
	var ordinSeq = el("bylOrdinSeq").value;
	var gubun = el("gubun").value;
	var vSct = $("#vSct").val();
	
	bylOrdinparam.bylSeq=temp[0];
	bylOrdinparam.bylNo=temp[1];
	bylOrdinparam.bylBrNo=temp[2];
	bylOrdinparam.bylClsCd=temp[3];
	bylOrdinparam.ordinId=ordinId;
	bylOrdinparam.gubun = gubun;
	bylOrdinparam.ordinSeq=ordinSeq;
    bylOrdinparam.vSct = vSct;
	
	fUpdateBylCall("bylListR","ordinBylHstInfoR.do",bylOrdinparam,bylOrdinView);
}

// 2018.11.29. 2018 국가법령 - 법령 별표/서식 본문 내용 비교 화면
function f_lsBylDiffHwpP() 
{
    if ($("select[id='bylList'] option:selected").index() == -1) {
        return;
    }

    var bylInfoId = ["bylSeq", "bylNo", "bylBrNo", "bylClsCd", "bylEfYd"];
    var bylInfoVal= $("select[id='bylList'] option:selected").val().split(",");
    var vParam=[], i=-1, j=0;

    vParam[++i] = "lsiSeq=" + $("#lsiSeq").val();
    vParam[++i] = "lsId=" + $("#bylLsId").val();
    vParam[++i] = "vSct=" + $("#vSct").val();

    //연혁목록에서 선택된 별표목록이 존재하면
    $("select[id='HstLsByl'] option").each(function() {
        if (bylInfoVal[0] == $(this).val()) {            
            if ($("select[id='HstLsByl'] option:selected").index() > -1) {
                vParam[++i] = bylInfoId[0] + "=" + $("select[id='HstLsByl'] option:selected").val();
                j = 1;
            }            
            return false;
        }
    });
    
    for (; j < bylInfoId.length; j++) {
        vParam[++i] = bylInfoId[j] + "=" + bylInfoVal[j];
    }    
    
    var url = "lsBylDiffHwpP.do?" + vParam.join("&");
    var win = window.open(url,"", "scrollbars=yes,toolbar=no,resizable=yes,status=no,location=yes,menubar=no");
    win.focus();    
}

function setDetailSelectBylCookie(lawKubun,seq){
	var dataId = "lawHistory";
	var dataSeq = "";
	if(lawKubun == 'ls'){
		dataSeq = "010108,0,"+seq;
	}else if(lawKubun == 'admRul'){
		dataSeq = "010108,1,"+seq;
	}else if(lawKubun == 'ordin'){
		dataSeq = "010108,2,"+seq;
	}
	
	
	if(dataSeq != ""){
		var datList = getDatList(dataId);
		var tempData = "";
		var uName = "";
		var isFirst = true;
		if(datList.length > 0){
			for(var i = 0; i < datList.length; i++){
				if ( datList[i] == dataSeq ) continue;

				if(tempData == ""){
						uName = "";
				}else{
						uName = "---";	
				}
				if (navigator.appName.charAt(0) == 'N') {
					tempData += uName + toUtf8(datList[i]);
				} else if (navigator.appName.charAt(0) == 'M') {
					tempData += uName + datList[i];
				}								
			}
			isFirst = false;
		}
		
		if( isFirst == true ) {
			uName = "";
		} else {
			uName = tempData + "---";
		}
		
		if (navigator.appName.charAt(0) == 'N') {
			setCookie(dataId, uName + toUtf8(dataSeq));
		} else if (navigator.appName.charAt(0) == 'M') {
			setCookie(dataId, uName + dataSeq);
		}	
		
		if(datList.length >= maxDetailCookie){		// 저장 개수 설정 
			delDetailSelectCookie(dataId);
		}						
	}
}

var chkFilter = true;

/**
 * <pre>
 * 검색값 초기화 및 필터 목록 변경
 * </pre>
 * 
 * @author smlee
 * @since 2023. 10. 12.
 * @param obj
 */
function setFilterChg(obj){
	chkFilter = false;
	
	// 해당 레벨의 select 객체로 변경 (select로 받을경우 그대로 사용)
	var obj = $(obj).is('select') ? $(obj) : $(obj).siblings('select');
	
	// 검색한 셀렉트박스의 값을 가져옴
	var cls = $(obj).find('option:selected').val() || $(obj).val();
	
	this.detailSearchYn = "N";
	
	setFilterChgSett(cls);
	
	// 페이지 초기화
	bylSearchObj.param.pg = 1;
	
	syncFilter(obj);
	
	// 서식명은 BYL_TTL_KO_SORT 기준 | 별표서식내용,법령명은 LS_NM_KO 기준 
	if(bylSearchObj.param.tabType != '1' && cls == '10'){
		cls = '20';
	}
	
	if (bylSearchObj.param.fsort == "") {
		if (cls == '10' || cls == '20' || cls == '30' || cls == '40') {
			selectChange(obj);
		}
	}
}

/**
 * <pre>
 * 검색값 초기화 및 필터 목록 변경
 * </pre>
 * 
 * @author smlee
 * @since 2023. 10. 12.
 * @param cls
 */
function setFilterChgSett(cls) {
	bylSearchObj.param.p1 = "";
	bylSearchObj.param.p2 = "";
	bylSearchObj.param.p3 = "";
	bylSearchObj.param.p4 = "";
	bylSearchObj.param.fsort = "";
	
	$("#filerGana").css('display', 'none');
	
	// 1뎁스 필터값으로 초기화
	if (cls == 10) { // 가나다 filter
		$("#filerGana").css('display', 'block');
		$("#filterSort").css('display', 'none');
	} else if (cls == 20){
		$("#filerGana").css('display', 'none');
		$("#filterSort").css('display', 'block');
	}
}

/**
 * <pre>
 * 	법령 WIDE 목록 셀렉트 박스 검색 (2뎁스)
 * </pre>
 * 
 * @author smlee
 * @since 2023. 10. 12.
 * @param obj
 */
function selectChange(obj) {
	if(typeof nonListGubun != 'undefined'){
		nonListGubun = true;
	}
	
	var $selectObj = obj instanceof $ ? obj : $(obj).siblings('select');
	
	// 1뎁스 여부
	var oneDepthYn = false;
	
	// 1뎁스에서 호출 할 때
	if ($selectObj.attr('id') === 'filSe') {
		oneDepthYn = true;
		
		// 이전 값을 가지고 있어 직접 접근
		var filterIndex = $('#' + $selectObj.attr('id')).find('option:selected').val();
		
		switch (parseInt(filterIndex)) {
			case 10:
				$selectObj = $('#selGana');
				break;
			default:
				$selectObj = $('#sortValue');
				break;
			}
	}
	setFilter($selectObj, oneDepthYn);
}

/**
 * <pre>
 * 	법령 WIDE 목록 셀렉트 박스 검색 (2뎁스-&gt;가나다별)
 * </pre>
 * 
 * @author smlee
 * @since 2023. 10. 12.
 * @param $selectObj
 */
function setFilter($selectObj, oneDepthYn) {
	syncFilter($selectObj, oneDepthYn);
	
	var value = $('#' + $selectObj.attr('id')).find('option:selected').val() || "";
	
	bylSearchObj.param.p1 = "";

	if($selectObj.attr('id') === "selGana"){
		bylSearchObj.param.dsort = '';

		if (bylSearchObj.param.tabType == "1") {
			bylSearchObj.param.p2 = value;
			bylSearchObj.param.fsort = '20';
		} else {
			bylSearchObj.param.p3 = value;
			bylSearchObj.param.fsort = '10';
		}
	} else if($selectObj.attr('id') === "sortValue"){
		bylSearchObj.param.fsort = '';
		if("desc" == value){
			bylSearchObj.param.dsort = '11';
		} else if ("asc" == value){
			bylSearchObj.param.dsort = '10';
		}
	}

	if ($("#query").val() || $('#sub15').is(':checked')) {
		txtSearch(false); // 초기화 여부
	} else {
		txtSearch();
	}
}

jQuery( document ).ready(function($) {
	$('#searchBtn').addClass("searchRun");
	$('#sForm').removeClass("loadingmessage");
	$('#retBox').hide();
	console.log( "System Ready" ); /* The Jurassic Park System Ready.*/
	//Adding Delay dont hurt wikipedia api.
	$('#searchInput').on("input", throttle (function(tval){ 
		$('#retBox').hide().empty();
       	$("#retInfoBox").hide().empty();
       	$("#resBtn").hide().empty();
		 //console.log($(this).val().length);
		if ( $.trim($(this).val()) || tval.which !== 0 && !tval.ctrlKey && !tval.metaKey && !tval.altKey) {
        	//console.log($(this).val());
        	 var wikiurl = "https://en.wikipedia.org/w/api.php?action=opensearch&search="+$(this).val()+"&format=json&callback=?";
        	 $('#sForm').addClass("loadingmessage");
				$.ajax({ 
					dataType: "json",
					url: wikiurl,
					})
				.done(function( data ) {
					$('#retBox').empty(); $("#retInfoBox").hide().empty();
					if (data.length !=0) {
						var dpos = $('#searchInput').offset();
						$('#retBox').css({"left":dpos.left+"px","top": (dpos.top+37) + "px"});
						$.each(data[1], function(i,item){
							//console.log(item);
							$('#retBox').append('<div class="dropInfo"><p class="dropInfoP">'+item+'</p><span class="dropInfoOk">[^]</span><p class="dropInfoDesc">'+data[2][i]+'<br/><a class="barLink" href="'+data[3][i]+'">Wikipedia-></a></p></div>');
						});
						$('#sForm').removeClass("loadingmessage");
						$('#retBox').show();
						var leftpos = $("#retBox").offset().left + $("#retBox").outerWidth();
						$("#retInfoBox").css({"left":(leftpos)+"px","top":($("#retBox").offset().top)+"px"})
										.show();
					}
				});
		}	
	},500));
	//Hover Just display More Information
	$('#retBox').on('click mouseover', '.dropInfo', function (event) { 
	    var intxt=$(this).find(".dropInfoDesc").html();
	    
	    //alert ($(this).find(".dropInfoDesc").html());
	    $("#retInfoBox").html(intxt)
	    				

	});	
	//Take value to Input
	$('#retBox').on('click', '.dropInfoOk', function (event) {	
		$('#searchInput').val($(this).parent().find(".dropInfoP").html());
		$('#resBtn').html('<a title="Go to Wikipedia Article" href="'+$(this).parent().find(".barLink").attr("href")+'">GO</a>');
		$("#resBtn").show();
		$('#retBox').hide(); 
		$("#retInfoBox").hide();
	});
	//Search on Wikipedia
	$('#searchBtn').on('click', $(this), function (event) {	
		$('#retBox').hide(); 
		$("#retInfoBox").hide(); 
		$('#searchBtn').css({"background-color":"#efbe5c","color":"#888"}).animate({"background-color":"#efbe5c","color":"#888"}, 1000);
		$('#sForm').addClass("loadingmessage");
		$("#resBtn").hide().empty();
		var wiki2="https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="+$('#searchInput').val()+"&srwhat=text&format=json&callback=?";
		var wikigourl='https://en.wikipedia.org/wiki/';
		$.ajax({ 
					dataType: "json",
					url: wiki2,
				})
				.done (function( data ) {
					$('#resltBox').html(data[2]);
					$('#searchBtn').css({"background-color":"#2196f3","color":"#f1f1f1"});
					$('#sForm').removeClass("loadingmessage");
					$('#resltBox').empty();
					$.each(data.query.search, function(i,item){
						$('#resltBox').append (
								'<div class="rslBox"><h2><a href="'+wikigourl+item.title+'">'+item.title+'</a></h2><p>'+item.snippet+' ...</p><p><a class="readOn" title="'+item.title+'"href="'+wikigourl+item.title+'">read on Wikipedia &raquo;</a> | <a class="dirRead">Read More</a></p><p class="timeS">Time: '+item.timestamp+' | No of Words: '+item.wordcount+'</p>'+'</div>'
							);
					});
				});

	});
	//Distraction Free Reading Mode.
	$('#resltBox').on('click','.dirRead', function (event) { 
		var goTitle = $(this).parent().find(".readOn").attr("title");
		var wikiUrls=$(this).parent().find(".readOn").attr("href");
		var goUrl = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exsectionformat=wiki&titles="+goTitle+"&redirects=true&format=json&callback=?";
		$('#loadingBox ').show();
		$('#resltBox').hide();
		$.ajax ({
				dataType: "json",
				url: goUrl, 
		})
		.done (function( data ) {
			$.each(data.query.pages, function(i,item){
				$('#disReadBoxIn').html (
						'<h2><a href="'+wikiUrls+'">'+item.title+'</a></h2>'+item.extract
					);
			});
			$('#disReadBox').show();
			$('#resltBox').hide();
			$('#loadingBox ').hide();
		});
	});
	//Close Overlay mode
	$('#closeBtn').click(function () { 
		$('#disReadBox').hide();
		$('#resltBox').show();
	});
  	//The Delay Function to control api request frequency.
  	function throttle(f, delay){ 
	    var timer = null;
	    return function(){
	        var context = this, args = arguments;
	        clearTimeout(timer);
	        timer = window.setTimeout(function(){
	            f.apply(context, args);
	        },
	        delay || 500);
	    };
	}  
    
});



var mainScene;

function setFireBright(bright, colour) {
    var fire;
    $.each(mainScene.children, function(idx, obj) {
      if (obj instanceof CB.Firems) {
        fire = obj;
      }
    });
    //alert(bright);
    fire.burnfactor = 120 + parseInt(bright);
    if(/*!colour ||*/ colour == "red") {
      fire.c1 = "#ffffff";
      fire.c2 = "#E9F23F";
      fire.c3 = "#e27023";
      fire.c4 = "#9b3513";
      fire.c5 = "#770000";
    } else if (colour == "white" || colour == "black" ) {
      fire.c1 = "white";
      fire.c2 = "white";
      fire.c3 = "gray";
      fire.c4 = "#dedede";
      fire.c5 = "white";
    } else if (colour == "green") {
      fire.c1 = "#ffffff";
      fire.c2 = "#66CC00";
      fire.c3 = "#66FF66";
      fire.c4 = "#00994C";
      fire.c5 = "#007700";
    } else if (colour == "blue") {
      fire.c1 = "#ffffff";
      fire.c2 = "#009999";
      fire.c3 = "#66B2FF";
      fire.c4 = "#003366";
      fire.c5 = "#000077";
    } else if (colour == "yellow") {
      fire.c1 = "#ffffff";
      fire.c2 = "#FFCC99";
      fire.c3 = "#FFFF00";
      fire.c4 = "#CCCC00";
      fire.c5 = "#777700";
    } else {
      fire.c1 = "#ffffff";
      fire.c2 = "#E9F23F";
      fire.c3 = "#e27023";
      fire.c4 = "#9b3513";
      fire.c5 = "#770000";
    }
  }

/*jshint strict: true */
/*global $ window document CB _c alert loadobjects */
window.main = (function() {
  
  'use strict';
  var defaultConfig = [ {
    "classname" : "Sky",
    "values" : {
      "light" : 0
    }
  }, {
    "classname":"Firems",
    values: {
      x: 0,
      y: 0
    }
    }
  ], fpsEl, textProp;

  function fpsreporter(fps) {
    $("#fps").text(String(fps));
  }

  function setInputValuesFromObject(obj) {
    $("input").each(function(idx, field) {
      var type = $(field).prop("type");
      if (obj[field.id] !== undefined) {
        if (type === "checkbox") {
          if ($(field).prop("checked") !== undefined) {
            $(field).prop("checked", Boolean(obj[field.id]));
          } else {
            $(field).prop("value", obj[field.id]);
          }
        }
        if (type === "number") {
          $(field).prop("value", obj[field.id]);
        }
      }
    });
  }

  function registerInputListeners(scene) {
    var fire, propId;
    $("input").on("change", function(evt) {
      var newValue, type = $(evt.target).prop("type");

      if (type === "checkbox") {
        newValue = Boolean(evt.target.checked);
      } else {
        newValue = parseInt(evt.target.value, 10);
      }
      if (evt.target.id) {
        propId = evt.target.id;
        if (fire && fire.onPropertyUpdate) {
          fire.onPropertyUpdate(propId, newValue);
        }
      }
    });

    $.each(scene.children, function(idx, obj) {
      if (obj instanceof CB.Firems) {
        fire = obj;
      }
    });

    if (fire) {
      setInputValuesFromObject(fire);
    }

    $("#boostbutton").on("click", function() {
      if (fire) {
        fire.boost();
      }
    });

    $("#firebutton").on("click", function() {
      setFireBright($("#fireqty").val());
    });

  }


  function start(canvasId, controlId) {
    var canvas, ctx, world;

    canvas = document.getElementById(canvasId);
    if (!canvas.getContext) {
      alert("Canvas not supported!");
      return;
    }

    ctx = canvas.getContext('2d');

    world = new CB.Scene({
      config : defaultConfig
    }, ctx);

    mainScene = world;
    registerInputListeners(world);

    CB.frameloop(ctx, world, null, fpsreporter);
  }


  return function(canvasId, controlId) {
      start(canvasId, controlId);
  };
})();

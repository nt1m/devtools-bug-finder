var BUG_URL = "https://bugzilla.mozilla.org/show_bug.cgi?id=";
var PRODUCT = "Firefox";
var COMPONENT_MAPPING = {
  main: {
    label: "Framework, toolbox UI and widgets",
    components: ["Developer Tools", "Developer Tools: Framework",
                 "Developer Tools: Object Inspector",
                 "Developer Tools: Source Editor"]
  },
  tilt: {
    label: "3D View",
    components: ["Developer Tools: 3D View"]
  },
  canvas: {
    label: "Canvas Debugger",
    components: ["Developer Tools: Canvas Debugger"]
  },
  console: {
    label: "Web Console",
    components: ["Developer Tools: Console"]
  },
  debugger: {
    label: "JS Debugger",
    components: ["Developer Tools: Debugger"]
  },
  gcli: {
    label: "Command Line",
    components: ["Developer Tools: Graphic Commandline and Toolbar"]
  },
  inspector: {
    label: "Inspector",
    components: ["Developer Tools: Inspector"]
  },
  perf: {
    label: "Performance & Memory Tools",
    components: ["Developer Tools: Memory",
                 "Developer Tools: Performance Tools (Profiler/Timeline)"]
  },
  network: {
    label: "Network Monitor",
    components: ["Developer Tools: Netmonitor"]
  },
  responsive: {
    label: "Responsive Mode",
    components: ["Developer Tools: Responsive Mode"]
  },
  scratchpad: {
    label: "Scratchpad",
    components: ["Developer Tools: Scratchpad"]
  },
  storage: {
    label: "Storage Inspector",
    components: ["Developer Tools: Storage Inspector"]
  },
  style: {
    label: "Style Editor",
    components: ["Developer Tools: Style Editor"]
  },
  audio: {
    label: "Web Audio Editor",
    components: ["Developer Tools: Web Audio Editor"]
  },
  shader: {
    label: "WebGL Shader Editor",
    components: ["Developer Tools: WebGL Shader Editor"]
  },
  webide: {
    label: "WebIDE",
    components: ["Developer Tools: WebIDE"]
  }
};
// How many days do we wait until considering an assigned bug as
// unassigned.
var INACTIVE_AFTER = 25;
var INCLUDED_FIELDS = ["id",
                       "assigned_to",
                       "summary",
                       "last_change_time",
                       "component",
                       "whiteboard"];

var bugzilla = bz.createClient({url: 'https://bugzilla.mozilla.org/bzapi'});

function getComponentParams(componentKeys) {
  if (!componentKeys) {
    return [];
  }

  var components = [];
  for (var i = 0; i < componentKeys.length; i ++) {
    var component = COMPONENT_MAPPING[componentKeys[i]];
    if (component) {
      components = components.concat(component.components);
    }
  }
  return components;
}

function getSearchParams(options) {
  options = options || {};

  var params = {
    // Search only devtools bugs.
    product: PRODUCT,
    component: [],
    // Opened bugs only.
    bug_status: ["NEW", "REOPENED", "UNCONFIRMED"],
    // Include all these fields in the response.
    include_fields: ["id", "assigned_to", "summary", "last_change_time",
                     "component", "whiteboard", "mentors"],
    // ???
    whiteboard_type: "contains_all",
    // List of whiteboard flags to search for.
    status_whiteboard: []
  };

  params.component = getComponentParams(options.components);

  if (options.type === "good-first") {
    // Only search for good-first-bugs (whether mentored or not).
    params.status_whiteboard.push("good first bug");
  } else if (options.type === "all-mentored") {
    // Search for all mentored bugs.
    params.f1 = "bug_mentor";
    params.o1 = "isnotempty";
  } else if (options.type === "all-bugs") {
    // Search for all bugs.
  }

  return params;
}

function timeFromModified(lastChangeTime) {
  var lastModified = new Date(lastChangeTime);
  var today = new Date();
  var oneDay = 1000*60*60*24;
  return Math.ceil(
    (today.getTime() - lastModified.getTime()) / oneDay
  );
}

function isInactive(bug) {
  return timeFromModified(bug.last_change_time) >= INACTIVE_AFTER;
}

function isAssigned(bug) {
  return !bug.assigned_to.name.match(/nobody/);
}

function getBugs(options, cb) {
  bugzilla.searchBugs(getSearchParams(options), function(_, list) {
    if (!list) {
      return;
    }
    // Post-processing filtering: either unassigned bugs or assigned
    // but with no activity for a while.
    list = list.filter(function(bug) {
      return !isAssigned(bug) || isInactive(bug);
    });
    cb(list);
  });
}

function createToolListMarkup(parentEl) {
  var keys = Object.keys(COMPONENT_MAPPING).sort(function(a, b) {
    a = COMPONENT_MAPPING[a].label;
    b = COMPONENT_MAPPING[b].label;
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
    return 0;
  });

  for (var i = 0; i < keys.length; i++) {
    var el = createNode({tagName: "li"});

    var input = createNode({
      tagName: "input",
      attributes: {
        type: "checkbox",
        value: keys[i],
        id: keys[i]
      }
    });

    var label = createNode({
      tagName: "label",
      textContent: COMPONENT_MAPPING[keys[i]].label,
      attributes: {"for": keys[i]}
    });

    el.appendChild(label);
    el.appendChild(input);

    parentEl.appendChild(el);
  }
}

function getSelectedTools() {
  if (document.querySelector("#all").checked) {
    return Object.keys(COMPONENT_MAPPING);
  }

  var els = document.querySelectorAll(".tools-list input");
  return [].filter.call(els, function(input) {
    return input.checked;
  }).map(function(input) {
    return input.value;
  });
}

function getSelectedType() {
  return [].filter.call(document.querySelectorAll(".type-list input"), function(input) {
    return input.checked;
  }).map(function(input) {
    return input.value;
  })[0];
}

function createEmptyListMarkup() {
  return createNode({
    tagName: "li",
    attributes: {
      "class": "bug"
    },
    textContent: "No bugs found"
  });
}

function createBugMarkup(bug) {
  var el = createNode({
    tagName: "li",
    attributes: {
      "class": "bug"
    }
  });

  el.appendChild(createNode({
    tagName: "a",
    textContent: "Bug " + bug.id + " - " + bug.summary,
    attributes: {
      "class": "bug-id",
      href: BUG_URL + bug.id,
      target: "blank"
    }
  }));

  el.appendChild(createNode({
    attributes: {
      "class": "tool-label"
    },
    textContent: getToolLabel(bug.component)
  }));

  el.appendChild(createNode({
    attributes: {"class": "mentor"},
    textContent: bug.mentors ? "Mentored by " + bug.mentors_detail.map(function(m) {
                   return m.real_name;
                 })[0] : ""
  }));

  return el;
}

function displayBugs(bugs) {
  var el = document.querySelector(".bugs");
  el.innerHTML = "";

  if (!bugs || !bugs.length) {
    el.appendChild(createEmptyListMarkup());
    return;
  }

  for (var i = 0; i < bugs.length; i++) {
    el.appendChild(createBugMarkup(bugs[i]));
  }
}

function onInput(e) {
  // Unselect all other inputs if the "all" input is checked.
  if (e.target.id === "all" && e.target.checked) {
    [].forEach.call(document.querySelectorAll(".tools-list input"), function(box) {
      if (box.id !== "all") {
        box.checked = false;
      }
    });
  }

  if (e.target.id !== "all" && e.target.type === "checkbox") {
    document.querySelector("#all").checked = false;
  }

  search();
}

var requestIndex = 0;
function search() {
  var componentKeys = getSelectedTools();
  if (!componentKeys.length) {
    displayBugs();
    return;
  }

  var type = getSelectedType();

  var index = ++requestIndex;
  document.body.classList.add("loading");
  getBugs({type: type, components: componentKeys}, function(list) {
    if (index !== requestIndex) {
      // A new request was started in the meantime, drop this one.
      return;
    }

    document.body.classList.remove("loading");
    displayBugs(list);
  });
}

function getToolLabel(component) {
  for (var i in COMPONENT_MAPPING) {
    var components = COMPONENT_MAPPING[i].components;
    for (var j = 0; j < components.length; j++) {
      if (components[j] === component) {
        return COMPONENT_MAPPING[i].label;
      }
    }
  }
  return null;
}

function createNode(options) {
  var el = document.createElement(options.tagName || "div");

  if (options.attributes) {
    for (var i in options.attributes) {
      el.setAttribute(i, options.attributes[i]);
    }
  }

  if (options.textContent) {
    el.textContent = options.textContent;
  }

  return el;
}

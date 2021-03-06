define([
  "dojo/_base/declare", 
  "dojo/_base/array", 
  "dojo/_base/lang",
  "dojo/query",
  "dojo/dom-style",
  "dojo/dom-class",
  "dojo/dom-construct",
  "dojo/keys",
  "dojo/on",
  "dojo/fx/Toggler",
  "dojo/fx",
  "dojo/data/ItemFileWriteStore",
  "dojo/hash",
  "dijit/_WidgetBase",
  "dijit/_TemplatedMixin",
  "dijit/_WidgetsInTemplateMixin",
  "dijit/layout/BorderContainer",
  "dijit/layout/TabContainer",
  "dijit/layout/ContentPane",
  "dijit/Toolbar",
  "dijit/Tooltip",
  "dijit/ProgressBar",
  "dijit/form/Button",
  "dijit/form/Select",
  "dijit/form/MultiSelect",
  "dijit/form/ToggleButton",
  "dijit/form/TextBox",
  "dijit/form/CheckBox",
  "dijit/Dialog",
  "dojox/layout/TableContainer",
  "scidrive/FilePanel",
  "scidrive/DataGrid",
  "scidrive/VosyncReadStore",
  "scidrive/JobsManager",
  "scidrive/DynamicPropertiesForm",
  "scidrive/NewFilePanel",
  "scidrive/NewDirPanel",
  "scidrive/AccountSettings",
  "dojox/grid/DataGrid",
  "dojo/text!./templates/ScidrivePanel.html"
  ],
  function(declare, array, lang, query, domStyle, domClass, domConstruct, keys, on, Toggler, coreFx, ItemFileWriteStore, hash, WidgetBase, TemplatedMixin, WidgetsInTemplateMixin,
    BorderContainer, TabContainer, ContentPane, Toolbar, Tooltip, ProgressBar, Button, Select, MultiSelect, ToggleButton, TextBox, CheckBox, Dialog, TableContainer,
    FilePanel, DataGrid, VosyncReadStore, JobsManager, DynamicPropertiesForm, NewFilePanel, NewDirPanel, AccountSettings, DojoDataGrid, template) {
    return declare([WidgetBase, TemplatedMixin, WidgetsInTemplateMixin], {
        templateString: template,

        panel1: null,
        panel2: null,
        current_panel: null,

        uploadPanelToggler: null,
        uploadPanelTogglerState: false,

        MAX_PATH_ELMS:5,

        updateCurrentPanel: function(panel) {

          var prev_panel = this.current_panel;

          this.current_panel = panel;

          domClass.remove(panel.domNode, "inactive");
          if(prev_panel != panel && prev_panel !== null)
            domClass.add(prev_panel.domNode, "inactive");

          thisPanel = this;
          var path = this.current_panel.gridWidget._currentPath;
          hash(path);
          var pathTokens = path.split('/');

          var pathHtml = pathTokens.map(function(element, index, array){
                if(index > 0) {
                    if(element.length <= 15)
                      return "<span class='pathelm' name='"+element+"'>"+element+"</span>";
                    else
                      return "<span class='pathelm' name='"+element+"' title='"+element+"'>"+element.slice(0,14)+"...</span>";
                } else {
                    return "<span class='pathelm' name=''>Root</span>";
                }
            }
          );

          var pathOnClick = pathTokens.map(function(element, index, array){
                var path = pathTokens.slice(0,index+1).join("/");
                if(path.length == 0)
                    path = "/";
                return path;
            }
          );

          while(pathHtml.length > this.MAX_PATH_ELMS) {
            if(pathHtml.length == this.MAX_PATH_ELMS+1) {
              pathHtml[1] = "<span class='pathelm' name=''>...</span>";
              break;
            } else {
              pathHtml.splice(1,1);
              pathOnClick.splice(1,1);
            }
          }

          var curPath = pathHtml.join(" ▸ ");
          this.pathSelect2.innerHTML = curPath;

          var that = this;
          query(".pathelm").forEach(function(item, num) {
              item.onclick = function(evt) {
                  thisPanel.current_panel._updateStore(pathOnClick[num]);
              };
          });


          if(prev_panel != panel) {
              this._updateUserInfo();
              this._refreshRegions();
          }

        },

        postCreate: function() {
            this.inherited(arguments);
            var panel = this;

            this.connect(this.loginSelect, "onChange", function(id) {
              var vospaceChosenArr = panel.app.vospaces.filter(function(elm, index, array) {
                return elm.id == id;
              });
              if(vospaceChosenArr.length > 0)
                this.loginToVO(vospaceChosenArr[0], this.current_panel);
              else
                console.debug("Something bad happened: can't find the region");
            });
        },

        startup: function() {
          this.inherited(arguments);
          this.uploadPanelToggler = new Toggler({
            node: this.fileuploads.id,
            showFunc: coreFx.wipeIn,
            hideFunc: coreFx.wipeOut
          });
          this.uploadPanelToggler.hide();
            // this._showSettingsManagerDialog();
        },

        _mkdirDialog: function() {
            var newDirPanel = NewDirPanel({
              current_panel: this.current_panel
            });
            newDirPanel.startup();

            var dialog = new Dialog({
              title: "Create new directory",
              content: newDirPanel,
              style: "width: 700px",
              onHide: function() {
                this.destroyRecursive();
              }
 
            });
            dialog.startup();
            dialog.show();
        },

        _mkfileDialog: function() {
          if(this.current_panel.gridWidget._currentPath == '/' && !this.current_panel.store.vospace.isShare) {
              alert("Regular files can't be created in root folder.");
          } else {
            var newFilePanel = new NewFilePanel({
              current_panel: this.current_panel
            });
            newFilePanel.startup();

            var dialog = new Dialog({
              title: "Create new file",
              content: newFilePanel,
              style: "width: 700px",
              onHide: function() {
                this.destroyRecursive();
              }
 
            });
            dialog.startup();
            dialog.show();
          }
        },

        _sharesDialog: function() {
          var panel = this;
          this.current_panel.store.vospace.request(
              this.current_panel.store.vospace.url + "/1/shares",
              "GET", {
                  'handleAs': "json"
              }
          ).then(
            function(shares) {

                var sharesGridDiv = domConstruct.create("div", {
                  style: {height: '400px'}
                });

                var data = {
                  identifier: "share_id",
                  items: shares
                };
                var store = new ItemFileWriteStore({data: data});

                var layout = [[
                  {'name': 'Container', 'field': 'container', 'width': '20%'},
                  //{'name': 'Group', 'field': 'group', 'width': '23%'},
                  {'name': 'Shared URL', 'field': 'share_id', 'width': '47%',
                    formatter: function(col, rowIndex) {
                      var url = location.protocol + '//' + location.host + location.pathname;
                      return "<a href=\""+url+"?share="+col+"\" target=\"_blank\">"+url+"?share="+col+"</a>";
                    }
                  },
                  {'name': 'Write', 'field': 'write_permission', 'width': '5%', 
                    formatter: function(col, rowIndex) {
                        return (col=='true')?"✔":"✘";
                    }
                  },
                  {'name': 'Remove', 'field':'share_id', 'width':'5%', 
                    formatter: function(col, rowIndex) {
                      var rowdata = this.grid.getItem(rowIndex);
                      var share_id = rowdata['share_id'];
                      var w = new Button({
                        label: "&#10060;",
                        iconClass: "deleteShareButton",
                        showLabel: true,
                        onClick: function(item) {
                          if (confirm("Remove share?")){
                            panel.current_panel.store.vospace.request(
                              panel.current_panel.store.vospace.url + "/1/shares/"+share_id,
                              "DELETE", {
                                  'handleAs': "json"
                              }
                            ).then(
                              function(data) {
                                store.deleteItem(rowdata); 
                              },
                              function(error) {
                                panel.current_panel._handleError(data, ioargs);
                              }
                            );
                          }
                        }
                    });
                    w._destroyOnRemove=true;
                    return w;
                  }
                }
                ]];

                // allowing browser menu in grid
                dojo.declare('scidrive.dojox.grid._FocusManager', dojox.grid._FocusManager, {
                    doContextMenu: function() {}
                });
                
                dojo.declare('scidrive.dojox.grid.DataGrid', dojox.grid.DataGrid, {
                    createManagers: function() {
                        this.rows = new dojox.grid._RowManager(this);
                        this.focus = new scidrive.dojox.grid._FocusManager(this);
                        this.edit = new dojox.grid._EditManager(this);
                    },
                    onRowContextMenu: function(e) {},
                    onHeaderContextMenu: function(e) {}
                });
                
                var grid = new scidrive.dojox.grid.DataGrid({
                  store: store,
                  structure: layout,
                  rowSelector: '0px'
                }, sharesGridDiv);


                var dlg = new dijit.Dialog({
                  title: "Shared Containers",
                  style: "width: 1020px; height: 560px",
                  content: grid,
                  autofocus: false,
                  onHide: function() {
                    this.destroyRecursive();
                  }
                });

                grid.startup();
                dlg.show();
                dojo.setSelectable(grid.id, true);
              },
              function(error) {
                panel.current_panel._handleError(error);
              }
          );

          //this.sharesDialog.show();
        },

        _help: function() {
            this.helpDialog.show();
        },

        _logout: function() {
          if(null != this.current_panel)
            this.current_panel._logout();
          else
            console.error("Not logged in.");
        },

        _refresh: function() {
          this.panel1._refresh();
          if(null != this.panel2)
            this.panel2._refresh();
        },

        _updateUserInfo: function() {

            var panel = this;

            function updateInfo(accountInfo) {
                panel.userLimitBar.update({
                  maximum: accountInfo.quota_info.quota,
                  progress: accountInfo.quota_info.normal
                });

                var tooltipText = accountInfo.quota_info.normal.fileSize(1)+
                " of "+accountInfo.quota_info.quota.fileSize(1)+" used";
                panel.userLimitTooltip.set("label", tooltipText);
                dijit.Tooltip.defaultPosition=['below-centered'];
                panel.userLimitTooltip.set("connectId",panel.userLimitBar.id);
                panel.current_panel.gridWidget.setUser(accountInfo.display_name);
            }

            this.current_panel.getUserInfo(updateInfo);

        },

        loginToVO: function(vospace, component) {
            if(!vospace) {
                console.error("Unknown vospace "+id);
                return;
            }

            if(vospace.isShare) {
              if(this.secondPanelButton)
                this.secondPanelButton.destroyRecursive();
              if(this.setCasJobsCredentialsButton)
                this.setCasJobsCredentialsButton.destroyRecursive();
              if(this.openCasJobsButton)
                this.openCasJobsButton.destroyRecursive();
              if(this.sharesButton)
                this.sharesButton.destroyRecursive();
              if(this.jobsPanelButton)
                this.jobsPanelButton.destroyRecursive();
            }

            var panel = this;

            var store = new VosyncReadStore({
                vospace: vospace,
                numRows: "items"
            });

            if(!vospace.credentials) {
                vospace.login(component, true);
            } else {
              if(component != null) {
                  store.parentPanel = component;
                  component.setStore(store);
                  this._updateUserInfo();
                  this._refreshRegions();
              } else { // init
                  if(undefined == this.panel1) {
                      this.panel1 = new FilePanel({
                          login: this.loginToVO,
                          store: store,
                          parentPanel: this
                          }).placeAt(this.panel1contentpane);
                      this.panel1.store.parentPanel = this.panel1;
                      this.updateCurrentPanel(this.panel1);
                  } else {
                      dojo.byId(this.panel2contentpane.id).style.width = "50%";
                      this.panel2 = new FilePanel({
                          login: this.loginToVO,
                          store: store,
                          parentPanel: this
                          }).placeAt(this.panel2contentpane);
                      this.panel2.store.parentPanel = this.panel2;
                      this.updateCurrentPanel(this.panel2);
                      this.rootContainer.resize();
                      this.panel1.gridWidget.resize();
                  }
              }
            }
        },

        /* Returns the list of region options for regions select */
        _getCurrentRegions: function() {
          var myOptions = null;
          if(typeof this.app.vospaces !== 'undefined') {

              myOptions = this.app.vospaces.map(function(vospace) {
                var authenticated = (typeof vospace.credentials !== 'undefined')?"* ":"  ";
                var selected = vospace.id == this.current_panel.store.vospace.id;
                var option = {value: vospace.id, 
                              selected : selected,
                              label: authenticated+vospace.display
                            };
                
                return option; 
              }, this);

                /*if(undefined != vospace.share) {

                  var shareSelected = share.id == this.store.vospace.share.id;
                  var shareAuthenticated = share.id == this.store.vospace.share.id;

                  var option = {value: share.id, 
                                selected : shareSelected,
                                label: authenticated+vospace.display
                  myOptions.push(option);

                }*/

            }

            return myOptions;
        },

        _addPanel: function() {
            if(this.panel2 == undefined) {
                this.loginToVO(this.panel1.store.vospace, null);
            } else {
                this.panel2.gridWidget._eventSource.close();
                this.panel2.gridWidget._eventSource = null;
                this.panel2.destroyRecursive();
                this.panel2 = null;
                dojo.byId(this.panel2contentpane.id).style.width = "0%";
                this.rootContainer.resize();
                this.panel1.gridWidget.resize();
                this.updateCurrentPanel(this.panel1);
            }
        },

        _search: function() {
          var panel = this;

          this.vospace.request(
            panel.current_panel.store.vospace.url + "/1/cont_search?query="+this.searchInput.value,
            "GET", {
                'handleAs': "json"
            }
          ).then(
              function(data) {
                var dlg = new dijit.Dialog({
                  title: "Search results",
                  content: data,
                  onHide: function() {
                    this.destroyRecursive();
                  }
                });

                dlg.show();

              },
              function(error) {
                panel.current_panel._handleError(error);
              }

          );
        },

        hideUploadPanel: function() {
          var haveUploads = (this.panel1 != undefined && this.panel1._isUploading) || (this.panel2 != undefined && this.panel2._isUploading);


          if(this.uploadPanelTogglerState && !haveUploads) {
            this.uploadPanelTogglerState = false;
            this.uploadPanelToggler.hide();
          }
        },

        showUploadPanel: function() {
          if(!this.uploadPanelTogglerState) {
            this.uploadPanelTogglerState = true;
            this.uploadPanelToggler.show();
          }
        },

        _refreshRegions: function() {
          if(this.loginSelect.getOptions().length == 0) {
            this.loginSelect.addOption(this._getCurrentRegions());
          } else {
            this.loginSelect.updateOption(this._getCurrentRegions());
          }
        },

        _destroyJobs: function() { // destroys jobs grid
          this.transfersManager.destroyRecursive();
        },
        
        _showJobsManagerDialog: function() {

          var transfersManager = new JobsManager({
            vospace: this.current_panel.store.vospace,
            transfers_url: this.current_panel.store.vospace.url+"/1/transfers",
            style: "width: 800px; height: 500px;"
          });
          
          var dialog = new Dialog({
              content: transfersManager,
              title: "Jobs list",
              onHide: function() {
                transfersManager.destroyRecursive();
                this.destroyRecursive();
              }
          });

          dialog.show();
      
        },

        _showSettingsManagerDialog: function() {

          var set = new TabContainer({
            style: "width: 100%; height: 500px;"
          });
          set.startup();

          var dialog = new Dialog({
            title: "Settings",
            style: "width: 95%; height: 560px;",
            onHide: function() {
              this.destroyRecursive();
            }

          });
          dialog.addChild(set);


          var that = this;

          var tabContainer = new TabContainer({
            doLayout: false,
            tabPosition: "left-h",
            //style: "height: 800px; width: 100%;",
            tabStrip: true,
            title: "Metadata extractors"
          });

          set.addChild(tabContainer);

          that.current_panel.getUserInfo(function(userInfo) {
            userInfo.services.map(function(service) {
              var cp = new ContentPane({
                  title: ((service.enabled)?'✔ ':'✘ ')+service.title,
                  onShow: function() {

                    var form = new DynamicPropertiesForm({
                      style: "height: 100%; width: 100%",
                      panel: that,
                      service: service,
                      save: function(jsonValues) {
                        if(this.onOffButton.get("value") == "on") {
                          this.panel.current_panel.store.vospace.request(
                              this.panel.current_panel.store.vospace.url +"/1/account/service/"+service.id,
                              "PUT", {
                                  'handleAs': "text",
                                  data: jsonValues,
                                  headers: { "Content-Type": "application/json"}
                              }
                          ).then(
                            function(data) {
                              cp.set("title",'✔'+cp.get("title").substring(1));
                              service.enabled = true;
                            },
                            function(error) {
                              this.panel.current_panel._handleError(data, ioargs);
                            }

                          );
                        } else {
                          this.panel.current_panel.store.vospace.request(
                              this.panel.current_panel.store.vospace.url +"/1/account/service/"+service.id,
                              "DELETE", {
                                  'handleAs': "text",
                                  data: jsonValues,
                                  headers: { "Content-Type": "application/json"}
                              }
                          ).then(
                            function(data) {
                              cp.set("title",'✘'+cp.get("title").substring(1));
                              service.enabled = false;
                            },
                            function(error) {
                              this.panel.current_panel._handleError(data, ioargs);
                            }

                          );
                        }

                      }
                    });

                    this.addChild(form);
                  },
                  onHide: function() {
                    this.destroyDescendants();
                  }
              });
              tabContainer.addChild(cp);
            });
          });

          var accountSettingsPanel = new AccountSettings({
            title: "Account",
            panel: this
          });
          accountSettingsPanel.startup();
          set.addChild(accountSettingsPanel);

          dialog.startup();
          dialog.show();


        }
    });

});


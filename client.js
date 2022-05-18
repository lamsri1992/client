require('dotenv').config()

var provider = process.env.provider
var local_php = process.env.local_php
var hcode = process.env.hcode
var hname = process.env.hname
var api_url = process.env.api_url
var api_scrip = process.env.api_scrip

console.log(hcode)

const { io } = require("socket.io-client")
const APP_PORT = 5001
const ver = "1.0.2"
var scripts
var scripts_data = new Map()
const qs = require('qs')
setTimeout(timer, 43200000)
function timer(e) {
    get_script()
    setTimeout(timer, 43200000)
}

var axioss = require('axios')
async function getData(cid, depart, vn, viewer_id, socket) {
    var data_form_his = []
    let script = scripts.find(o => o.script_name === 'service')
    var sql = script.script_sql
    sql = sql.replace("$cid", cid).replace("$cid", cid)

    try {
        var params = new URLSearchParams()
        params.append("script", sql)
        let res = await axioss.post(local_php + "/index.php", params)
        if (res.status == 200) {
            data_form_his = res.data
        }
    }
    catch (err) {
        console.error(err);
    }
    var vns = ""
    for (let sv of data_form_his) {
        vns += "'" + sv.vn + "',"
        sv.hcode = hcode
        sv.hname = hname
    }
    vns = vns.substring(0, vns.length - 1)

    var tpm_data = []
    for (let sc of scripts) {
        if (sc.script_name != 'service') {
            var sql = sc.script_sql
            sql = sql.replace("$cid", cid).replace("$cid", cid)
            sql = sql.replace("$vn", vns).replace("$vn", vns)
            sql = sql.replace("$an", vns).replace("$an", vns)

            try {
                var params = new URLSearchParams()
                params.append("script", sql)
                let res = await axioss.post(local_php + "/index.php", params)
                if (res.status == 200) {
                    var tmp = []
                    tmp.sc_name = sc.script_name
                    tmp.data = res.data
                    tpm_data.push(tmp)
                }
                //console.log(sc.script_name)
            }
            catch (err) {
                console.error(err);
            }
        }
    }

    for (let sv of data_form_his) {
        sv.data = []
        sv.client_id = socket.id
        var j = '{"diag": [{"ICD10": "","DiagName": "","DiagType": ""}],"drug": [{"DrugName": "","strength": "","qty":0,"drugusage": ""}],"procedure": [{"icd9name": ""}],"appointment": {"nextdate": "","nexttime": "","clinic": "","contact": "","note": "","note1": "","note2": ""},"lab": [{"labcode": "","labname": "","result": "","unit": "","ref": "","remark": "","approve_staff": ""}]}'
        var jtmplate = JSON.parse(j)

        for (let d of tpm_data) {
            if (d != null) {
                if (d.data != 'Error connection database!') {
                    var find_vn = d.data.filter(vn => vn.vn == sv.vn)
                    var script_name = d.sc_name
                    if (find_vn == null) {
                        jtmplate[script_name] = []
                    } else {
                        //for (let vn of find_vn) {
                        jtmplate[script_name] = find_vn
                        //}
                    }

                } else {
                    jtmplate[script_name] = Array(d.data)
                }

            }
        }
        sv.data = jtmplate
    }

    if (data_form_his != null) {
        var d = '{"cid":"' + cid + '","viewer_id":"' + viewer_id + '","data":[]}'
        var return_data = JSON.parse(d)
        return_data.data = data_form_his
        var j = JSON.stringify(return_data)
        //console.log(j)
        console.log("Client(Viewer id=" + viewer_id + ")==> Server")
        socket.emit('client', j)
    } else {
        return_data.his_data = []
        socket.emit('client', JSON.stringify(return_data));
    }
}

function get_script() {
    console.log("get_script")
    var params = new URLSearchParams()
    //params.append('provider', provider)
    var axios = require('axios')
    axios.get(api_scrip + "/api.php?service_type=scripts_api&provider=" + provider)
        .then((result) => {
            //console.log(result)
            try {
                scripts = result.data
                for (let x of scripts) {
                    //console.log(x.script_sql)
                    //x.script_sql = x.script_sql.split('\n').join(' ').split('\r').join(' ').split('\t').join(' ')
                }
            } catch (error) {
                console.log("error=Get Script")
            }
        })
    axios.get(api_scrip + "/api.php?service_type=scripts_data&provider=" + provider)
        .then((result) => {
            //console.log(result)
            try {
                for (let data of result.data) {
                    scripts_data.set(data.script_name, data.script_sql)
                }
            } catch (error) {
                console.log("error=Get Script")
            }
        })
}

async function get_data_query(query, socket, viewer_id) {
    try {
        var params = new URLSearchParams()
        //params.append('provider', provider)
        var axios = require('axios')
        //query="select * from patient limit 1"
        params.append("script", query)
        console.log("SQL : " + query)
        let res = await axios.post(local_php + "/index.php", params)
        if (res.status == 200) {
            var query_data = { "viewer_id": viewer_id, "data": res.data }
            console.log(query_data)
            var Json_data = JSON.stringify(query_data)
            socket.emit('patient_client', Json_data)
        }
    }
    catch (err) {
        console.log(err)
    }
}

get_script()

const socket = io(api_url + ":" + APP_PORT, { 'force new connection': true });

socket.on("connect", (sockets) => {
    console.log("Connected server")
    socket.emit('joinroom', 'client')
    socket.emit('hospital', '{"hcode":"' + hcode + '","provider":"' + provider + '","hname":"' + hname + '(' + ver + ')"}')

    socket.on("greetings", (message) => {
        console.log(message)
    })

    socket.on("query", (query) => {
        var data = JSON.parse(query)
        var sql = data.sql
        get_query(sql, socket, data.key)
    })

    async function get_query(sql, socket, key) {
        try {
            var axios = require('axios')
            var params = new URLSearchParams()
            console.log("SQL :" + sql)
            params.append("script", sql)
            let res = await axios.post(local_php + "/index.php", params)
            if (res.status == 200) {
                var query_data = { "data": res.data, "id": socket.id, "data_type": "query", "key": key }
                var Json_data = JSON.stringify(query_data)
                socket.emit('query', Json_data)
                console.log("Emit->")
            } else {
                console.log(res)
            }
        }
        catch (err) {
            console.log(err)
        }
    }

    // socket.on("query", (query) => {
    //     var sql = ""
    //     data = JSON.parse(query)
    //     sql = data.sql        
    //     //CefSharp.PostMessage({ "data_type": "query", "script": sql, "Callback": data_back });

    //     function data_back(message) {
    //         //alert(message)
    //         document.write("Emit to SERVER<br>")
    //         socket.emit('query', message);
    //     }
    // })

    socket.on("patient", (query) => {
        var sql = ""
        data = JSON.parse(query)
        sql = scripts_data.get("patient").replace('$cid', data.cid)
        get_data_query(sql, socket, data.viewer_id)
    })


    socket.on("shell", (message) => {
        const { exec } = require("child_process")
        var shell_script = message.split('!!')
        console.log(shell_script)
        for (let s of shell_script) {
            console.log(s)
            exec(s, (error, stdout, stderr) => {
                if (error) {
                    console.log(`error: ${error.message}`)
                    return;
                }
                if (stderr) {
                    console.log(`stderr: ${stderr}`)
                    return;
                }
                console.log(`stdout: ${stdout}`)
            })
        }
    })

    socket.on("get_script", (message) => {
        get_script()
    })

    socket.on("restart", (message) => {
        const { exec } = require("child_process")
        exec("pm2 restart client", (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`)
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`)
                return;
            }
            console.log(`stdout: ${stdout}`)
        })
    })

    socket.on("client", (message) => {
        var data = JSON.parse(message)
        var datatype = data.datatype
        var viewer_id = data.data.viewer_id
        getData(data.data.CID, data.depart, data.vn, viewer_id, socket)
    })
})

// "mysql": "^2.15.0"

function toWhereSql(queryCondition) {

    var keys = Object.keys(queryCondition);
    var values = [];
    var whereSql = " 1=1 ";
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = queryCondition[k];
        values.push(v);
        if (k.indexOf("`") >= 0) {
            //k :  "`name` like %?%"
            whereSql += (" and " + k + "  ");
        } else {
            whereSql += (" and `" + k + "` = ? ");
        }
    }

    return {
        whereSql: whereSql,
        values: values
    };
}


function SimpleDAO(dbModel, connectionPool) {
    this.dbModel = dbModel;
    this.connectionPool = connectionPool;
    this.createSpringDataJpaFunction();
}


SimpleDAO.prototype.getConnectionPool = function () {
    if (this.connectionPool) {
        return this.connectionPool;
    }
};


SimpleDAO.prototype.isTableField = function (fieldName) {
    var tableFields = this.dbModel.tableFields;
    for (var j = 0; j < tableFields.length; j++) {
        var obj1 = tableFields[j];
        if (obj1 === fieldName) {
            return true;
        }
    }
    return false;
};


SimpleDAO.prototype.doExecuteSql = function (requestModel) {

    var sql = requestModel['sql'];
    var params = requestModel['params'] || [];

    console.log(sql);

    const that = this;
    return new Promise(function (resolve, reject) {

        var pool = that.getConnectionPool();
        pool.getConnection(function (err1, connection) {

            if (err1) {
                reject(err1);
                return;
            }

            // LogUtils.info(sql);

            connection.query(sql, params, function (err2, results, fields) {
                connection.release();
                if (err2) {
                    reject(err2);
                } else {
                    resolve(results);
                }
            });
        });

    });
};


SimpleDAO.prototype.doQueryByWhereSql = function (whereSql, whereValues) {
    var tableName = this.dbModel.tableName;
    return this.doExecuteSql({
        sql: "select * from `" + tableName + "` where " + whereSql,
        params: (whereValues || [])
    });
};


SimpleDAO.prototype.doQuery = function (queryCondition, sql_suffix) {
    var mm = toWhereSql(queryCondition);
    var whereSql = mm.whereSql + " " + (sql_suffix || "");
    return this.doQueryByWhereSql(whereSql, mm.values);
};

SimpleDAO.prototype.doCount = function (queryCondition) {
    var mm = toWhereSql(queryCondition);
    var tableName = this.dbModel.tableName;
    return this.doExecuteSql({
        sql: "select count(0) from `" + tableName + "` where " + mm.whereSql,
        params: mm.values
    });
};


SimpleDAO.prototype.doQueryById = function (id) {
    return this.doQuery({"id": id});
};


SimpleDAO.prototype.doQueryByName = function (name) {
    return this.doQuery({"name": name});
};


SimpleDAO.prototype.doDeleteByWhereSql = function (whereSql, whereValues) {
    var tableName = this.dbModel.tableName;
    return this.doExecuteSql({
        sql: "delete from `" + tableName + "` where " + whereSql,
        params: (whereValues || [])
    });
};

SimpleDAO.prototype.doDelete = function (queryCondition) {
    var mm = toWhereSql(queryCondition);
    return this.doDeleteByWhereSql(mm.whereSql, mm.values);
};

SimpleDAO.prototype.doDeleteById = function (id) {
    return this.doDelete({id: id});
};


SimpleDAO.prototype.doInsert = function (insertObject) {

    insertObject['update_time'] = new Date().getTime();
    insertObject['create_time'] = new Date().getTime();

    let that = this;
    let tableName = that.dbModel.tableName;
    var objectKeys = Object.keys(insertObject);

    var insertKeys = [];
    var insertValues = [];
    var insertValuesHolder = [];

    for (var i = 0; i < objectKeys.length; i++) {
        var objKey = objectKeys[i];
        var objValue = insertObject[objKey];

        if (that.isTableField(objKey)) {
            insertKeys.push("`" + objKey + "`");
            insertValuesHolder.push("?");
            insertValues.push(objValue);
        }
    }


    var insertKeysString = insertKeys.join(",");
    var insertValuesHolderString = insertValuesHolder.join(",");

    var sql = "INSERT INTO  `" + tableName + "` (" + insertKeysString + ") VALUES(" + insertValuesHolderString + ")";

    return that.doExecuteSql({
        sql: sql,
        params: insertValues
    });
};


SimpleDAO.prototype.doUpdateByWhereSql = function (updateObject, whereSql, whereValues) {
    updateObject['update_time'] = new Date().getTime();

    let that = this;

    var objectKeys = Object.keys(updateObject);
    var tableName = that.dbModel.tableName;

    var updateKeys = [];
    var updateValues = [];

    for (var i = 0; i < objectKeys.length; i++) {
        var objKey = objectKeys[i];
        var objValue = updateObject[objKey];

        if (that.isTableField(objKey)) {
            updateKeys.push(" `" + objKey + "`=? ");
            updateValues.push(objValue);
        }
    }

    var updateKeysString = updateKeys.join(",");

    var sql = "update `" + tableName + "` set " + updateKeysString + "  where " + whereSql;

    return that.doExecuteSql({
        sql: sql,
        params: updateValues.concat(whereValues)
    });

};


SimpleDAO.prototype.doUpdate = function (updateObject, whereObject) {
    var mm = toWhereSql(whereObject);
    var whereSql = mm.whereSql;
    var whereValues = mm.values;
    return this.doUpdateByWhereSql(updateObject, whereSql, whereValues);
};


SimpleDAO.prototype.doUpdateById = function (updateObject, id) {
    return this.doUpdate(updateObject, {id: id});
};


SimpleDAO.prototype.saveOrUpdate = function (updateObject, whereCondition) {
    var query_result = this.doQuery(whereCondition);
    return query_result.then(function (result) {
        if (result && result.length > 0) {
            return this.doUpdate(updateObject, whereCondition);
        } else {
            return this.doInsert(updateObject);
        }
    });
};


SimpleDAO.prototype.saveOrUpdateById = function (updateObject, id) {
    return this.saveOrUpdate(updateObject, {id: id});
};







function isJpaKeyword(word) {
    var jpakeyword = ["Not","In","Null","Like","Between","LessThan","GreaterThan"];
    for (var i = 0; i < jpakeyword.length; i++) {
        var obj = jpakeyword[i];
        if(obj === word){
            return true;
        }
    }
    return false;
}



SimpleDAO.prototype._autoAddEquals = function (expressString) {
    var that = this;
    var expressArray = expressString.replace(/([A-Z])/g,"-$1").split("-");
    //"Name", "And", "Sex"
    expressArray.push("");

    var expressArray2 = [];
    for (var i = 0; i < expressArray.length; i++) {
        var word = expressArray[i];
        expressArray2.push(word);

        var wordLower = word.toLowerCase();
        if(that.isTableField(wordLower)){
            var nextWorld = expressArray[i+1];
            if(!nextWorld || !isJpaKeyword(nextWorld)){
                expressArray2.push("Equals");
            }
        }
    }

    return expressArray2.join("");

};


function addStringLabel(arr) {
    var arr2 = [];
    for (var i = 0; i < arr.length; i++) {
        var a = arr[i];
        if(a){
            if(typeof a === "string"){
                a = "'"+ a +"'";
            }
            arr2.push(a);
        }
    }
    return arr2;
}



SimpleDAO.prototype._createFindByFunction = function (modelKey) {
    var expressString = modelKey.replace(/^findBy/,"");
    expressString = this._autoAddEquals(expressString);

    var sql = "select * from `" + this.dbModel.tableName + "` where ";


    // ageAndName

    var that = this;
    var beginIndex = 0 ;
    var endIndex =0;
    while (endIndex < expressString.length){
        var word = expressString.slice(beginIndex,endIndex+1);

        var wordLower = word.toLowerCase();
        if(that.isTableField(wordLower) ){
            sql += " `" +wordLower + "`   ";
            beginIndex  += word.length;
        }

        else if(word === "And"){
            sql +=" and ";
            beginIndex  += word.length;
        }

        else if(word === "Or"){
            sql +=" or ";
            beginIndex  += word.length;
        }
        else if(word === "Is"){
            sql +=" is ";
            beginIndex  += word.length;
        }
        else if(word === "Not"){
            sql +=" not ";
            beginIndex  += word.length;
        }
        else if(word === "Null"){
            sql +=" null ";
            beginIndex  += word.length;
        }
        else if(word === "Like"){
            sql +=" like CONCAT('%',?,'%') ";
            beginIndex  += word.length;
        }
        else if(word === "In"){
            sql +=" in (ID_IN_STRING) ";
            beginIndex  += word.length;
        }
        else if(word === "Equals"){
            sql +=" = ? ";
            beginIndex  += word.length;
        }
        else if(word === "LessThan"){
            sql +=" < ? ";
            beginIndex  += word.length;
        }
        else if(word === "GreaterThan"){
            sql +=" > ? ";
            beginIndex  += word.length;
        }

        else if(word === "Between"){
            sql +=" between (?,?) ";
            beginIndex  += word.length;
        }

        endIndex++;
    }


    sql=sql.replace(/\s+/gm,' ')
    console.log(sql);
    return function () {

        var sql2 = "" + sql;

        var args = Array.prototype.slice.apply(arguments);

        var args2 = [];
        for (var i = 0; i < args.length; i++) {
            var arg = args[i];
            if (Array.isArray(arg)) {
                var ID_IN_STRING =  addStringLabel(arg).join(",");
                sql2 = sql2.replace("ID_IN_STRING",ID_IN_STRING);
            }else {
                args2.push(arg);
            }
        }

        return this.doExecuteSql({
            sql: sql2,
            params: args2
        });

    };
};



SimpleDAO.prototype.createSpringDataJpaFunction = function () {
    var that = this;
    var dbModel = this.dbModel;
    var modelKeys = Object.keys(dbModel);
    for (var i = 0; i < modelKeys.length; i++) {
        var modelKey = modelKeys[i];
        if(modelKey.indexOf("findBy")===0){
            that[modelKey] = that._createFindByFunction(modelKey);
        }
    }
};

module.exports =  SimpleDAO ;

//
//
// var PersonModel = {
//     tableName: "aaa.t_person",
//     tableFields: [
//         "id", "name","age","sex","firstname", "update_time", "create_time"
//     ],
//     "findByIdOrNameLike":null,
//     "findByName":null,
//     "findByNameEquals":function (name) {},
//     "findByNameEqualsAndSexEquals ":function (name) {},
//     "findByNameAndSex":function (name) {},
//     "findBySexAndNameOrAgeIn":function (sex,age,ageArray) {},
//     "findBySexEqOrAgeEq":function (sex,age) {},
//     "findByAgeIn":null,
//     "findByAgeNotIn":null,
//     "findByNameIsNull":null,
//     "findByNameIsNotNull":null,
//     "findByFirstnameLike":null,
//     "findByFirstnameNotLike":null,
//     "findByCreate_timeNotBetweenAndName":null,
// };
//
// var PersonDAO = new SimpleDAO(PersonModel,null);
//
// var idListString = [1, 2, 3, 4, 5, 6, 7].join(",");
// PersonDAO.doExecuteSql({
//     sql: `select * from ${PersonModel.tableName} where id in(${idListString})`,
//     params: []
// });
//
// PersonDAO.findByName("zhang");
// PersonDAO.findByAgeIn(["1",2,3]);
//
// PersonDAO.doQueryByWhereSql("name = ? and sex = ?" , ["luan",1]);
// PersonDAO.doQueryByWhereSql(`age in (${idListString})`);
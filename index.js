

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


function MySQLWrapper(dbModel, connectionPool) {
    this.dbModel = dbModel;
    this.connectionPool = connectionPool;
}


MySQLWrapper.prototype.getConnectionPool = function () {
    if (this.connectionPool) {
        return this.connectionPool;
    }
};


MySQLWrapper.prototype.isTableField = function (fieldName) {
    var tableFields = this.dbModel.tableFields;
    for (var j = 0; j < tableFields.length; j++) {
        var obj1 = tableFields[j];
        if (obj1 === fieldName) {
            return true;
        }
    }
    return false;
};


MySQLWrapper.prototype.doExecuteSql = function (requestModel) {

    var sql = requestModel['sql'];
    var params = requestModel['params'] || [];


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


MySQLWrapper.prototype.doQueryByWhereSql = function (whereSql, whereValues) {
    var tableName = this.dbModel.tableName;
    return this.doExecuteSql({
        sql: "select * from `" + tableName + "` where " + whereSql,
        params: (whereValues || [])
    });
};


MySQLWrapper.prototype.doQuery = function (queryCondition, sql_suffix) {
    var mm = toWhereSql(queryCondition);
    var whereSql = mm.whereSql + " " + (sql_suffix || "");
    return this.doQueryByWhereSql(whereSql, mm.values);
};

MySQLWrapper.prototype.doCount = function (queryCondition) {
    var mm = toWhereSql(queryCondition);
    var tableName = this.dbModel.tableName;
    return this.doExecuteSql({
        sql: "select count(0) from `" + tableName + "` where " + mm.whereSql,
        params: mm.values
    });
};


MySQLWrapper.prototype.doQueryById = function (id) {
    return this.doQuery({"id": id});
};


MySQLWrapper.prototype.doQueryByName = function (name) {
    return this.doQuery({"name": name});
};


MySQLWrapper.prototype.doDeleteByWhereSql = function (whereSql, whereValues) {
    var tableName = this.dbModel.tableName;
    return this.doExecuteSql({
        sql: "delete from `" + tableName + "` where " + whereSql,
        params: (whereValues || [])
    });
};

MySQLWrapper.prototype.doDelete = function (queryCondition) {
    var mm = toWhereSql(queryCondition);
    return this.doDeleteByWhereSql(mm.whereSql, mm.values);
};

MySQLWrapper.prototype.doDeleteById = function (id) {
    return this.doDelete({id: id});
};


MySQLWrapper.prototype.doInsert = function (insertObject) {

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


MySQLWrapper.prototype.doUpdateByWhereSql = function (updateObject, whereSql, whereValues) {
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


MySQLWrapper.prototype.doUpdate = function (updateObject, whereObject) {
    var mm = toWhereSql(whereObject);
    var whereSql = mm.whereSql;
    var whereValues = mm.values;
    return this.doUpdateByWhereSql(updateObject, whereSql, whereValues);
};


MySQLWrapper.prototype.doUpdateById = function (updateObject, id) {
    return this.doUpdate(updateObject, {id: id});
};


MySQLWrapper.prototype.saveOrUpdate = function (updateObject, whereCondition) {
    var query_result = this.doQuery(whereCondition);
    return query_result.then(function (result) {
        if (result && result.length > 0) {
            return this.doUpdate(updateObject, whereCondition);
        } else {
            return this.doInsert(updateObject);
        }
    });
};


MySQLWrapper.prototype.saveOrUpdateById = function (updateObject, id) {
    return this.saveOrUpdate(updateObject, {id: id});
};


module.exports = {
    MySQLWrapper: MySQLWrapper
};


//
// var PersonModel = {
//     tableName: "aaa.t_person",
//     tableFields: [
//         "id", "name", "update_time", "create_time"
//     ]
// };
//
// var mm = new MySQLWrapper(PersonModel);
//
// var idListString = [1, 2, 3, 4, 5, 6, 7].join(",");
// mm.doExecuteSql({
//     sql: `select * from ${PersonModel.tableName} where id in(${idListString})`,
//     params: []
// });
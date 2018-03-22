

async function test1() {
    var connection = await getConnection();
    await connection.beginTransaction();

    // var result = await connection.query(sql);

    var PersonDAO = new SimpleDAO(PersonModel,connection);
    var PostDAO = new SimpleDAO(PostModel,connection);

    await connection.beginTransaction();

    var personList = await PersonDAO.doQueryById(222);
    await PostDAO.doQueryById("22");

    connection.commit();

    connection.end();
}


function getConnection() {
    return new Promise(function (resolve) {
        pool.getConnection(function (connection) {
            resolve(connection);
        });
    });
}

function releaseConnection(connection) {
    connection.release();
}

async function test2() {
    var PersonDAO = new SimpleDAO(PersonModel,getConnection,releaseConnection);
    var person12 = await PersonDAO.doQueryById(12)[0];
    if(person12){

    }
}
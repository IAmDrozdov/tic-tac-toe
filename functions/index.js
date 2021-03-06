const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const firestore = admin.app().firestore();

exports.onUserStatusChanged = functions.database
  .ref("/status/{userId}")
  .onUpdate((change, context) => {
    const { userId } = context.params;
    const usersRef = firestore.collection("users");
    const matchesRef = firestore.collection("matches");
    const publicRef = firestore.collection("public");
    const { online, match } = change.after.val();
    if (!online) {
      usersRef
        .doc(userId)
        .update({ online: false });
      publicRef
        .where("uid", "==", userId)
        .get()
        .then(snapshot =>
          snapshot.forEach(qds =>
            qds.ref.delete()));
      if (match) {
        matchesRef.doc(match).get()
          .then(doc => {
              const { userX, userO } = doc.data();
              const win = userId === userX ? userO : userX;
              doc.ref.update({ win });
            }
          );
      }
    }
  });

exports.onMatchChanged = functions.firestore
  .document("matches/{matchId}")
  .onUpdate((change, context) => {
    const { matchId } = context.params;
    const matchRef = firestore.collection("matches").doc(matchId);
    const { win } = change.after.data();
    if (win) {
      matchRef.delete();
    }
  });

exports.onMatchRemoved = functions.firestore
  .document("matches/{matchId}")
  .onDelete((snap, context) => {
    const { matchId } = context.params;
    const usersRef = firestore.collection("users");
    const { win } = snap.data();
    usersRef.where("match", "==", matchId)
      .get()
      .then(snapshot =>
        snapshot.forEach(qds => {
          const user = qds.ref;
          const toUpdate = {
            matchesCount: admin.firestore.FieldValue.increment(1)
          };

          switch (win) {
            case user.id:
              toUpdate.winsCount = admin.firestore.FieldValue.increment(1);
              break;
            case "draw":
              break;
            default:
              toUpdate.losesCount = admin.firestore.FieldValue.increment(1);

          }
          user
            .update({
              ...toUpdate,
              match: admin.firestore.FieldValue.delete()
            });

          user
            .collection("activity")
            .where("matchId", "==", matchId)
            .get()
            .then(snapshot2 =>
              snapshot2.forEach(qds2 =>
                qds2.ref.delete())
            );
        })
      );
  });
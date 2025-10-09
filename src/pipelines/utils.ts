export const isValidBase64 = (str: string) => {
    if (!str || str.length % 4 !== 0) return false;
    const regex = /^[A-Za-z0-9+/=]+$/;
    return regex.test(str.replace(/\s/g, ""));
};


export const decodeBase64Encoding = (encodedString: string): string => {
    try {
        if (isValidBase64(encodedString)) {
            const decodedString = atob(encodedString);
            return decodedString;
        }
        return "";
    } catch (error) {
        return "";
    }
}

`
async function vectorSearchExample(queryText: string) {
    const queryVector = await getVectorEmbedding(queryText);

    const results = await FileVector.aggregate([
        {
            $vectorSearch: {
                index: "vector_index",       // your Atlas vector index
                path: "vector",              // the vector field in your collection
                queryVector: queryVector,    // the embedding array
                numCandidates: 10,           // number of candidates to consider
                limit: 3                     // number of top results to return
            }
        },
        {
            $project: {
                fileId: 1,
                contextId: 1,
                score: 1 
            }
        }
    ]);

    console.log(results);
}

vectorSearchExample("change Red button to Green");`